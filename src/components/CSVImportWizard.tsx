import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useApp } from '../contexts/AppContextSupabase';
import { enhancedCsvImportService, type ColumnMapping, type ImportProfile, type ImportResult } from '../services/enhancedCsvImportService';
import {
  transactionImportService,
  type BulkImportResult
} from '../services/transactionImportService';
import { importTransactionsLocally } from '../services/localTransactionImportService';
import { summariseMissingRows, type MissingRowsSummary } from '../utils/partialImportSummary';
import type { Account, Transaction } from '../types';
import {
  UploadIcon,
  FileTextIcon,
  CheckIcon,
  XIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SaveIcon,
  RefreshCwIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';
import { Modal } from './common/Modal';
import ImportProgress from './common/ImportProgress';
import CSVBankTemplates from './CSVBankTemplates';
import { formatShortDate } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/currency-decimal';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('CSVImportWizard');

/** How many of the file's rows the preview step shows. */
const PREVIEW_ROWS = 5;

const previewHeadCell =
  'px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';

interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'transaction' | 'account';
  /**
   * A file chosen somewhere else — the Batch Import queue hands this wizard the
   * next .csv on its list. Accepting one here is what lets that queue stay a
   * queue: it never parses or writes a row, because this wizard does all of it
   * exactly as it does for a file dropped below — including the column mapping
   * step, which is the whole reason a CSV cannot be imported unattended.
   */
  initialFile?: File;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'result';

/** A draft the file produced that names an account this user actually has. */
interface RoutedRow {
  accountId: string;
  draft: Omit<Transaction, 'id'>;
}

/**
 * What this import DID, as opposed to what the file offered.
 *
 * `parsed` is the service's own tally: rows it could read, rows it could not,
 * rows it left out as duplicates. `landed` is the only number that describes
 * the register — it comes back from the write, not from the parse. They used to
 * be the same number, which is how a file could report "412 imported" with
 * nothing at all in the account.
 */
interface WizardOutcome {
  parsed: ImportResult;
  landed: number;
  /** Rows a write refused, grouped by the account they were bound for. */
  missingByAccount: Array<{ accountName: string; summary: MissingRowsSummary }>;
  /** Rows that name no account this user has, so there is nowhere to file them. */
  unroutable: { count: number; names: string[]; noAccountColumn: boolean };
  /** The first write error, so the user has something to act on or quote. */
  reason?: string;
}

/**
 * Is this one of the transactions the file produced, rather than an account?
 *
 * `ImportResult.items` holds either, and only a transaction carries a `date` —
 * an Account has `lastUpdated`. Narrowing here rather than casting keeps the
 * field reads below type-checked.
 */
const isTransactionDraft = (
  item: Partial<Transaction> | Partial<Account>
): item is Partial<Transaction> =>
  'date' in item && 'amount' in item && 'description' in item && 'type' in item;

export default function CSVImportWizard({ isOpen, onClose, type, initialFile }: CSVImportWizardProps): React.JSX.Element {
  const {
    accounts,
    transactions,
    categories,
    isUsingSupabase,
    refreshAccountsAndTransactions
  } = useApp();
  const { getToken } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [csvContent, setCsvContent] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ImportProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<WizardOutcome | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [duplicateThreshold, setDuplicateThreshold] = useState(90);
  /**
   * What the WRITE has confirmed so far, never what was hoped for. `total` is
   * set once every row has been routed to an account; `inserted` only ever
   * moves on a report from a writing path.
   */
  const [progress, setProgress] = useState<{ inserted: number; total: number } | null>(null);

  // An import awaits several writes and can settle after the wizard unmounts;
  // a setState then runs against a torn-down react-dom. Same pattern as the
  // QIF and OFX modals.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset wizard
  const resetWizard = () => {
    setCurrentStep('upload');
    setCsvContent('');
    setHeaders([]);
    setData([]);
    setMappings([]);
    setSelectedProfile(null);
    setImportResult(null);
    setImportError(null);
    setProgress(null);
  };

  /**
   * Read a file and move to the mapping step. The one path into this wizard,
   * shared by the drop zone, the file input and the `initialFile` prop, so a
   * queued file gets the identical treatment to a hand-picked one.
   */
  const acceptFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = typeof e.target?.result === 'string' ? e.target.result : '';
      setCsvContent(content);

      // Parse CSV
      const parsed = enhancedCsvImportService.parseCSV(content);
      setHeaders(parsed.headers);
      setData(parsed.data);

      // Auto-suggest mappings
      const suggestedMappings = enhancedCsvImportService.suggestMappings(parsed.headers, type);
      setMappings(suggestedMappings);

      setCurrentStep('mapping');
    };
    reader.readAsText(file);
  }, [type]);

  /**
   * Compared by IDENTITY, not by name: re-rendering with the same File must not
   * re-read it and throw the user back to the mapping step, while a second file
   * that happens to share a name still gets read.
   */
  const loadedInitialFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (!initialFile || loadedInitialFileRef.current === initialFile) return;
    loadedInitialFileRef.current = initialFile;
    acceptFile(initialFile);
  }, [acceptFile, initialFile]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    acceptFile(file);
  }, [acceptFile]);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      acceptFile(file);
    }
  }, [acceptFile]);

  // Update mapping
  const updateMapping = (index: number, field: keyof ColumnMapping, value: string | ((value: string) => string | number | boolean | null)) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  // Add new mapping
  const addMapping = () => {
    setMappings([...mappings, { sourceColumn: '', targetField: '' }]);
  };

  // Remove mapping
  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  // Load profile
  const loadProfile = (profile: ImportProfile) => {
    setSelectedProfile(profile);
    setMappings(profile.mappings);
  };

  // Save profile
  const saveProfile = () => {
    const profileName = prompt('Enter a name for this import profile:');
    if (!profileName) return;

    const profile: ImportProfile = {
      id: `profile-${Date.now()}`,
      name: profileName,
      type,
      mappings,
      lastUsed: new Date()
    };

    enhancedCsvImportService.saveProfile(profile);
    setSelectedProfile(profile);
  };

  // Process import
  const processImport = async () => {
    setIsProcessing(true);
    setImportError(null);

    try {
      if (type === 'transaction') {
        // Create account map
        const accountMap = new Map(accounts.map(acc => [acc.name, acc.id]));

        const result = await enhancedCsvImportService.importTransactions(
          csvContent,
          mappings,
          transactions,
          accountMap,
          {
            skipDuplicates: showDuplicates,
            duplicateThreshold,
            categories: categories || [],
            autoCategorize: true,
            categoryConfidenceThreshold: 0.7
          }
        );

        // ── Route every drafted row to a real account ──────────────────────
        //
        // A CSV names its account in a column, so unlike an OFX statement one
        // file can carry several — and a row whose account name matches nothing
        // has nowhere to go. That case used to be handled by an `'accountId' in
        // item` test that skipped the row in silence while the success tile went
        // on counting it, so a file with no Account column mapped reported
        // hundreds imported and put nothing anywhere. Rows that cannot be filed
        // are collected and named instead.
        const accountsById = new Map(accounts.map(account => [account.id, account]));
        const routed: RoutedRow[] = [];
        const unroutableNames = new Set<string>();
        let unroutableCount = 0;
        let rowsWithoutAnyAccount = 0;

        for (const item of result.items) {
          if (!isTransactionDraft(item)) continue;

          const accountId = typeof item.accountId === 'string' ? item.accountId : '';
          if (!accountsById.has(accountId)) {
            unroutableCount += 1;
            // The service replaces an unrecognised name with 'default' and
            // deletes the name, so an unmatched name and an unmapped column are
            // indistinguishable by then — both are reported, differently.
            if (typeof item.accountName === 'string' && item.accountName) {
              unroutableNames.add(item.accountName);
            } else {
              rowsWithoutAnyAccount += 1;
            }
            continue;
          }

          routed.push({
            accountId,
            draft: {
              date: item.date instanceof Date ? item.date : new Date(String(item.date)),
              description: item.description ?? '',
              amount: item.amount ?? 0,
              type: item.type ?? 'expense',
              accountId,
              category: item.category ?? '',
              cleared: item.cleared ?? false,
              ...(item.notes !== undefined ? { notes: item.notes } : {}),
              ...(item.tags !== undefined ? { tags: item.tags } : {}),
              // Whether the category is the file's own word or the app's guess.
              // Set by the import service; carried rather than rebuilt, because
              // only the service knows which of the two it was.
              ...(item.categoryConfirmed !== undefined
                ? { categoryConfirmed: item.categoryConfirmed }
                : {})
            }
          });
        }

        // ── Write, one account at a time, each batch all-or-nothing ────────
        //
        // Cloud: one `import_transactions_atomic` per chunk. Local: one
        // IndexedDB `setMany` covering the rows and the balance together.
        // Awaited either way — the un-awaited per-row loop this replaces fired
        // every write at once and dropped every promise.
        //
        // A failing account does NOT stop the rest: these are separate accounts
        // with nothing to do with each other, and refusing to file the Barclays
        // rows because the Amex ones would not write helps nobody. Every miss is
        // named below, per account, so the file can be re-run against just those.
        const byAccount = new Map<string, Omit<Transaction, 'id'>[]>();
        for (const { accountId, draft } of routed) {
          const existing = byAccount.get(accountId);
          if (existing) existing.push(draft);
          else byAccount.set(accountId, [draft]);
        }

        if (isUsingSupabase && byAccount.size > 0) {
          transactionImportService.setAuthTokenProvider(() => getToken());
        }

        let landed = 0;
        let reason: string | undefined;
        const missingByAccount: WizardOutcome['missingByAccount'] = [];

        // The size of the job, known now that every row has been routed to an
        // account and before a single one is written. Nothing is claimed as
        // inserted yet.
        const rowsToWrite = routed.length;
        if (isMountedRef.current && rowsToWrite > 0) {
          setProgress({ inserted: 0, total: rowsToWrite });
        }

        for (const [accountId, rows] of byAccount) {
          const account = accountsById.get(accountId);
          // A multi-account file writes one account at a time, so the count on
          // screen is what has landed ACROSS accounts so far — the cloud path
          // reports per chunk, the local one only when its single atomic write
          // for that account is done.
          const alreadyLanded = landed;
          const outcome: BulkImportResult = isUsingSupabase
            ? await transactionImportService.importInChunks(accountId, rows, {
                // Fires between chunks, so it can also land after unmount.
                onProgress: p => {
                  if (isMountedRef.current) {
                    setProgress({ inserted: alreadyLanded + p.inserted, total: rowsToWrite });
                  }
                }
              })
            : await importTransactionsLocally(accountId, rows);

          landed += outcome.inserted;
          if (isMountedRef.current && rowsToWrite > 0) {
            setProgress({ inserted: landed, total: rowsToWrite });
          }
          if (!outcome.complete) {
            missingByAccount.push({
              accountName: account?.name ?? 'this account',
              summary: summariseMissingRows(rows.slice(outcome.inserted), account?.currency ?? 'GBP')
            });
            reason = reason ?? outcome.error;
          }
        }

        // The store is the authority on what landed — read it back rather than
        // assuming the drafts made it.
        if (byAccount.size > 0) {
          await refreshAccountsAndTransactions();
        }

        if (!isMountedRef.current) return;
        setImportResult({
          parsed: result,
          landed,
          missingByAccount,
          unroutable: {
            count: unroutableCount,
            names: [...unroutableNames],
            noAccountColumn: rowsWithoutAnyAccount > 0
          },
          reason
        });
      } else {
        // Import accounts
        // TODO: Implement account import
      }

      if (isMountedRef.current) {
        setCurrentStep('result');
      }
    } catch (error) {
      // This used to be a bare console.error, which left the wizard sitting on
      // the preview step with no message at all — indistinguishable from a
      // button that did nothing.
      logger.error('Import error', error);
      if (isMountedRef.current) {
        setImportError(error instanceof Error ? error.message : 'Import failed');
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        setProgress(null);
      }
    }
  };

  // Target fields for mapping
  const targetFields = type === 'transaction'
    ? ['date', 'description', 'amount', 'category', 'accountName', 'tags', 'notes', 'balance']
    : ['name', 'type', 'balance', 'currency', 'institution'];

  /**
   * The preview, built the way the import builds it.
   *
   * ── WHY NOT THE RAW CELLS ───────────────────────────────────────────────────
   * This table used to print `row[headers.indexOf(mapping.sourceColumn)]` per
   * target field. For the many UK banks that ship SEPARATE Debit and Credit
   * columns, both mapped to `amount`, that showed the FIRST mapping's cell and
   * nothing else — so every credit row (empty Debit cell) previewed blank while
   * the import wrote it correctly. The screen said one thing and the register
   * said another, on the exact rows people check hardest.
   *
   * generatePreview wraps the SAME buildTransactionFromRow the import uses, so
   * the debit/credit resolution, the explicit type column, the date parsing and
   * the skipping of rows with no usable amount are all one implementation. What
   * is on screen is what will be written.
   *
   * ── WHY ONE CALL PER ROW ────────────────────────────────────────────────────
   * generatePreview DROPS rows it cannot build (a zero-amount debit/credit pair
   * carries no direction, so it is not imported). Called once for the batch, the
   * output no longer lines up with the file's rows and a dropped row simply
   * vanishes from the preview. One call per row keeps the alignment, which is
   * what lets a skipped row be shown AS skipped — the honest answer, and the one
   * that stops a user hunting for it in the register afterwards.
   *
   * Accounts are not previewed this way: generatePreview builds transactions,
   * and an account import's fields (name, currency, institution) are the file's
   * own cells with nothing to resolve.
   */
  const previewRows = useMemo(() => {
    if (type !== 'transaction') return null;
    return data.slice(0, PREVIEW_ROWS).map(row => ({
      row,
      built: enhancedCsvImportService.generatePreview(headers, [row], mappings).transactions[0] ?? null
    }));
  }, [type, data, headers, mappings]);

  /** Which optional columns the file actually maps, so none is a column of dashes. */
  const previewShowsCategory = mappings.some(m => m.targetField === 'category');
  const previewShowsAccount = mappings.some(m => m.targetField === 'accountName');

  /**
   * The file's own date cell for a row.
   *
   * The one raw value the preview keeps, because it is the one the built value
   * can hide: 01/06/2025 is the 1st of June or the 6th of January depending on
   * a decision made inside the parser, and reading the built date alone can
   * never catch that. Every other column is shown as it will be written.
   */
  const sourceDateCell = (row: string[]): string => {
    const mapping = mappings.find(m => m.targetField === 'date');
    const index = mapping ? headers.indexOf(mapping.sourceColumn || '') : -1;
    return index >= 0 ? (row[index] ?? '') : '';
  };

  /**
   * The currency to print a previewed amount in: the DESTINATION account's,
   * matching the write path and summariseMissingRows. These are the numbers
   * printed on the statement in front of the user, and converting them to a
   * display currency would make them unfindable. Falls back to the same 'GBP'
   * the write path falls back to when the file names no account.
   */
  const previewCurrency = (accountName: string | undefined): string =>
    accounts.find(account => account.name === accountName)?.currency ?? 'GBP';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CSV Import Wizard" size="xl">
      {/* h-[600px] is the PREFERRED height; min-h-0 lets flex shrink it when
          the Modal panel's max-height is smaller (a laptop with the window
          half-height), so the step content scrolls inside itself instead of
          the wizard's lower half being clipped off unreachable. */}
      <div className="flex flex-col h-[600px] min-h-0">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-4">
            <StepIndicator 
              label="Upload" 
              isActive={currentStep === 'upload'} 
              isComplete={['mapping', 'preview', 'result'].includes(currentStep)} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Map Columns" 
              isActive={currentStep === 'mapping'} 
              isComplete={['preview', 'result'].includes(currentStep)} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Preview" 
              isActive={currentStep === 'preview'} 
              isComplete={currentStep === 'result'} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Import" 
              isActive={currentStep === 'result'} 
              isComplete={false} 
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {currentStep === 'upload' && (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div 
                className="w-full max-w-md p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center hover:border-primary transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Upload CSV File
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Drag and drop your CSV file here, or click to browse
                </p>
                {/* sr-only, NOT hidden: display:none takes the input out of
                    the tab order entirely, and a <label> cannot hold focus in
                    its place — so the only way to reach this picker was a
                    mouse. Off-screen the input still takes focus, and
                    focus-within paints the ring on the button the user can
                    actually see. */}
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary cursor-pointer focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                  <FileTextIcon size={20} />
                  Select File
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="sr-only"
                    id="csv-upload"
                  />
                </label>
              </div>

              {/* Bank Templates */}
              <CSVBankTemplates
                onSelectBank={(bankMappings) => {
                  setMappings(bankMappings);
                  setCurrentStep('mapping');
                }}
              />
            </div>
          )}

          {currentStep === 'mapping' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Column Mapping
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Map your CSV columns to the appropriate fields
                </p>
              </div>

              {/* Saved Profiles */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Import Profiles
                  </label>
                  <button
                    onClick={saveProfile}
                    className="text-sm text-primary hover:text-secondary transition-colors"
                  >
                    <SaveIcon size={16} className="inline mr-1" />
                    Save Current
                  </button>
                </div>
                <select
                  value={selectedProfile?.id || ''}
                  onChange={(e) => {
                    const profile = enhancedCsvImportService.getProfiles(type)
                      .find(p => p.id === e.target.value);
                    if (profile) loadProfile(profile);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a saved profile...</option>
                  {enhancedCsvImportService.getProfiles(type).map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mappings */}
              <div className="space-y-3">
                {mappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <select
                      value={mapping.sourceColumn}
                      onChange={(e) => updateMapping(index, 'sourceColumn', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select CSV column...</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    
                    <span className="text-gray-500">→</span>
                    
                    <select
                      value={mapping.targetField}
                      onChange={(e) => updateMapping(index, 'targetField', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select target field...</option>
                      {targetFields.map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => removeMapping(index)}
                      className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <XIcon size={20} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addMapping}
                className="mt-4 text-sm text-primary hover:text-secondary transition-colors"
              >
                + Add Mapping
              </button>
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Preview Import
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review the first few rows to ensure correct mapping
                </p>
              </div>

              {/* Duplicate Detection Settings */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showDuplicates}
                      onChange={(e) => setShowDuplicates(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Skip duplicate transactions
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      Threshold:
                    </label>
                    <input
                      type="number"
                      value={duplicateThreshold}
                      onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                      min="50"
                      max="100"
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <caption className="sr-only">
                    {previewRows
                      ? 'The first rows of the file as they will be written'
                      : 'The first rows of the file'}
                  </caption>
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {previewRows ? (
                        <>
                          <th scope="col" className={previewHeadCell}>Date</th>
                          <th scope="col" className={previewHeadCell}>Description</th>
                          <th scope="col" className={`${previewHeadCell} text-right`}>Amount</th>
                          <th scope="col" className={previewHeadCell}>Type</th>
                          {previewShowsCategory && <th scope="col" className={previewHeadCell}>Category</th>}
                          {previewShowsAccount && <th scope="col" className={previewHeadCell}>Account</th>}
                        </>
                      ) : (
                        targetFields
                          .filter(field => mappings.some(m => m.targetField === field))
                          .map(field => (
                            <th key={field} scope="col" className={previewHeadCell}>
                              {field}
                            </th>
                          ))
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                    {previewRows
                      ? previewRows.map(({ row, built }, rowIndex) => {
                          const columns = 4 + (previewShowsCategory ? 1 : 0) + (previewShowsAccount ? 1 : 0);
                          if (!built) {
                            // Shown rather than dropped: this row carries no
                            // usable amount, so the import will pass over it —
                            // and silence here is how somebody spends an
                            // evening looking for it in the register.
                            return (
                              <tr key={rowIndex}>
                                <td colSpan={columns} className="px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
                                  Will be skipped — this row has no usable amount
                                </td>
                              </tr>
                            );
                          }
                          const date = built.date instanceof Date ? built.date : new Date(String(built.date));
                          const shown = formatShortDate(date);
                          const source = sourceDateCell(row);
                          const amount = built.amount ?? 0;
                          return (
                            <tr key={rowIndex}>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                {shown || <span className="text-amber-700 dark:text-amber-400">Unreadable date</span>}
                                {/* The file's own cell, when it does not read
                                    back identically — the one place a wrong
                                    day/month order can be spotted. */}
                                {source && source !== shown && (
                                  <span className="block text-xs text-gray-400 dark:text-gray-500">
                                    in the file: {source}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {built.description ?? ''}
                              </td>
                              <td
                                className={`px-4 py-2 text-sm text-right tabular-nums whitespace-nowrap ${
                                  amount < 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-green-700 dark:text-green-400'
                                }`}
                              >
                                {formatCurrency(amount, previewCurrency(built.accountName))}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                {built.type ?? ''}
                              </td>
                              {previewShowsCategory && (
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {built.category ?? ''}
                                </td>
                              )}
                              {previewShowsAccount && (
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {built.accountName ?? ''}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      : data.slice(0, PREVIEW_ROWS).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {targetFields
                              .filter(field => mappings.some(m => m.targetField === field))
                              .map(field => {
                                const mapping = mappings.find(m => m.targetField === field);
                                const columnIndex = mapping ? headers.indexOf(mapping.sourceColumn || '') : -1;
                                const value = columnIndex >= 0 ? row[columnIndex] : '';

                                return (
                                  <td key={field} className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                    {mapping?.transform ? mapping.transform(value)?.toString() ?? '' : value}
                                  </td>
                                );
                              })}
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {previewRows && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  These are the values that will be written — a bank&apos;s separate Debit and Credit
                  columns have already been resolved into one signed amount.
                </p>
              )}

              {data.length > PREVIEW_ROWS && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Showing {PREVIEW_ROWS} of {data.length} rows
                </p>
              )}

              {/* The import threw before it could write anything. Previously
                  this was logged and nothing else, so pressing Import looked
                  like pressing a dead button. */}
              {importError && (
                <div
                  role="alert"
                  className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
                >
                  <p className="text-sm text-red-800 dark:text-red-200">
                    Nothing was imported and nothing was changed — this file could
                    not be read far enough to write anything.
                  </p>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    What went wrong: {importError}
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 'result' && importResult && (
            <div className="p-6">
              <div className="text-center mb-6">
                {/* "Complete" is a claim, so it is only made when the file
                    actually finished: nothing missing and nothing unfiled. */}
                {importResult.missingByAccount.length === 0 && importResult.unroutable.count === 0 ? (
                  <>
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                      <CheckIcon size={32} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Import Complete!
                    </h3>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
                      <XIcon size={32} className="text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {importResult.landed === 0
                        ? 'Nothing was imported'
                        : 'Part of this file is missing'}
                    </h3>
                  </>
                )}
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  {/* What the WRITE confirmed. This tile used to show the
                      parser's tally, so a file that reached the database not at
                      all still read as a few hundred imported. */}
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {importResult.landed}
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">Imported</p>
                </div>

                {importResult.parsed.duplicates > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                      {importResult.parsed.duplicates}
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">Skipped</p>
                  </div>
                )}

                {importResult.parsed.failed > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {importResult.parsed.failed}
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-300">Unreadable</p>
                  </div>
                )}
              </div>

              {/* Rows a write refused, named per account — the count alone
                  cannot be acted on, and the person reading this has the file
                  in front of them. */}
              {importResult.missingByAccount.map(({ accountName, summary }) => (
                <div
                  key={accountName}
                  className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
                >
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                    {summary.count === 1
                      ? `1 transaction never reached ${accountName}`
                      : `${summary.count} transactions never reached ${accountName}`}
                  </h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                    They are not in the register, so {accountName} will not agree
                    with the statement this file came from:
                  </p>
                  <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                    {summary.named.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                    {summary.hidden > 0 && (
                      <li className="text-gray-600 dark:text-gray-400">
                        …and {summary.hidden} more, from {summary.earliestDate} onwards.
                      </li>
                    )}
                  </ul>
                </div>
              ))}

              {/* Rows with nowhere to go. Previously skipped in silence while
                  the Imported tile counted them anyway. */}
              {importResult.unroutable.count > 0 && (
                <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                    {importResult.unroutable.count === 1
                      ? '1 transaction had no account to go into'
                      : `${importResult.unroutable.count} transactions had no account to go into`}
                  </h4>
                  {importResult.unroutable.names.length > 0 && (
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                      Their Account column names {importResult.unroutable.names.join(', ')}, and
                      you have no account of that name. Rename the account here to
                      match the file, or correct the file, then import it again —
                      nothing was written for these rows.
                    </p>
                  )}
                  {importResult.unroutable.noAccountColumn && (
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      No column is mapped to <strong>accountName</strong>, so there
                      is nothing to say which account these belong in. Go back to
                      Map Columns, map the account column, and import again.
                    </p>
                  )}
                </div>
              )}

              {importResult.reason && (
                <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                  What stopped it: {importResult.reason}
                </p>
              )}

              {/* Rows the parser could not read at all */}
              {importResult.parsed.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2">
                    Rows that could not be read
                  </h4>
                  <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    {importResult.parsed.errors.slice(0, 5).map((error: { row: number; error: string }, index: number) => (
                      <li key={index}>
                        Row {error.row}: {error.error}
                      </li>
                    ))}
                    {importResult.parsed.errors.length > 5 && (
                      <li>... and {importResult.parsed.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions — during a write this row becomes the progress
            region, because it is the one part of the wizard that never
            scrolls out of sight. */}
        <div className="flex justify-between items-center gap-4 p-6 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={currentStep === 'upload' ? onClose : () => {
              const steps: WizardStep[] = ['upload', 'mapping', 'preview', 'result'];
              const currentIndex = steps.indexOf(currentStep);
              if (currentIndex > 0) {
                setCurrentStep(steps[currentIndex - 1]);
              }
            }}
            disabled={isProcessing}
            // Said, not just enforced: a dead button with no explanation is
            // indistinguishable from a broken one.
            title={isProcessing ? 'Import in progress' : undefined}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon size={20} />
            {currentStep === 'upload' ? 'Cancel' : 'Back'}
          </button>

          {/* No row count until the rows have been routed to accounts: how many
              a file will write is not known while duplicates are still being
              weighed, and a number here would be a guess presented as a fact. */}
          {isProcessing && (
            <div className="flex-1 min-w-0">
              <ImportProgress inserted={progress?.inserted ?? null} total={progress?.total ?? null} />
            </div>
          )}

          <div className="flex gap-3">
            {currentStep === 'result' ? (
              <>
                <button
                  onClick={resetWizard}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <RefreshCwIcon size={20} />
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
                >
                  Done
                </button>
              </>
            ) : (
              <LoadingButton
                isLoading={isProcessing}
                loadingText="Importing…"
                onClick={() => {
                  if (currentStep === 'mapping') {
                    setCurrentStep('preview');
                  } else if (currentStep === 'preview') {
                    processImport();
                  }
                }}
                className="flex items-center gap-2 px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50"
                disabled={
                  (currentStep === 'mapping' && mappings.length === 0) ||
                  isProcessing
                }
              >
                {currentStep === 'preview' ? (
                  <>
                    <UploadIcon size={20} />
                    Import
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRightIcon size={20} />
                  </>
                )}
              </LoadingButton>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Step Indicator Component
function StepIndicator({ 
  label, 
  isActive, 
  isComplete 
}: { 
  label: string; 
  isActive: boolean; 
  isComplete: boolean; 
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Animated ring for active step */}
        {isActive && (
          <div className="absolute inset-0 w-10 h-10 rounded-full bg-primary/20 animate-ping" />
        )}
        <div
          className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
            isComplete
              ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
              : isActive
              ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/30 scale-110'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}
        >
          {isComplete ? (
            <CheckIcon size={20} className="animate-[bounce_0.5s_ease-in-out]" />
          ) : (
            <span className="font-semibold">{label.charAt(0)}</span>
          )}
        </div>
      </div>
      <span className={`text-xs mt-2 font-medium transition-colors duration-200 ${
        isComplete
          ? 'text-blue-600 dark:text-blue-400'
          : isActive 
          ? 'text-primary' 
          : 'text-gray-500 dark:text-gray-400'
      }`}>
        {label}
      </span>
    </div>
  );
}
