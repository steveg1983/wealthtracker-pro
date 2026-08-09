import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { qifImportService } from '../services/qifImportService';
import { dataPort, type BulkImportResult } from '../services/port';
import type { Account } from '../types';
import type { QIFParseResult } from '../services/qifImportService';
import { Modal, ModalBody } from './common/Modal';
import {
  UploadIcon,
  FileTextIcon,
  CheckIcon,
  AlertCircleIcon,
  InfoIcon,
  RefreshCwIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';
import ImportProgress from './common/ImportProgress';
import AccountSelector from './common/AccountSelector';
import { createScopedLogger } from '../loggers/scopedLogger';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

interface QIFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * A file chosen somewhere else — the Batch Import queue hands this dialog the
   * next .qif on its list. Accepting one here is what lets that queue stay a
   * queue: it never parses or writes a row, because this dialog does all of it
   * exactly as it does for a file dropped below — including asking which
   * account the file belongs to, which a QIF never says.
   *
   * The queue routes by extension, so the .qif check that guards the drop zone
   * is deliberately NOT repeated for this path — a file that turns out not to
   * be QIF fails in the parse and is reported there rather than swallowed.
   */
  initialFile?: File;
}

type QIFImportResult = Awaited<ReturnType<typeof qifImportService.importTransactions>>;

type ImportOutcome =
  | {
      success: true;
      imported: number;
      duplicates: number;
      invalidDates: number;
      matchedCategories: number;
      unmatchedCategories: { name: string; count: number }[];
      /** False when a chunk failed partway — imported < intended. */
      complete: boolean;
      account: Account | null;
    }
  | {
      success: false;
      error: string;
    };

export default function QIFImportModal({ isOpen, onClose, initialFile }: QIFImportModalProps): React.JSX.Element {
  const { accounts, transactions, categories, refreshAccountsAndTransactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  /**
   * What the WRITE has confirmed so far, never what was hoped for. `total` is
   * set the moment the rows to write are known (after duplicates are dropped),
   * so the dialog can name the size of the job before the first row lands;
   * `inserted` only ever moves on a report from the writing path (chunk by
   * chunk in the cloud; a device write is one atomic transaction and reports
   * nothing until it is done).
   */
  const [progress, setProgress] = useState<{ inserted: number; total: number } | null>(null);
  const [parseResult, setParseResult] = useState<QIFParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportOutcome | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // An import awaits many writes and can settle AFTER unmount; the setState in
  // the finally below then runs against a torn-down react-dom (the intermittent
  // pre-commit/quality-gates error). Every post-await setState checks this ref
  // first. Reset on mount because Strict Mode remounts reuse the same ref.
  // Same pattern as SyncConflictResolver.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const logger = useMemo(() => createScopedLogger('QIFImportModal'), []);

  const parseFile = useCallback(async (targetFile: File) => {
    setIsProcessing(true);
    try {
      const content = await targetFile.text();
      const parsed = qifImportService.parseQIF(content);

      setParseResult(parsed);

      if (accounts.length === 1) {
        setSelectedAccountId(accounts[0].id);
      }
    } catch (error) {
      logger.error('Error parsing QIF file', error as Error);
      alert('Error parsing QIF file. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  }, [accounts, logger]);
  
  /**
   * Take a file: clear whatever the last one left behind, then parse it. The
   * one path into this dialog, shared by the drop zone, the file input and the
   * `initialFile` prop, so a queued file gets the identical treatment to a
   * hand-picked one.
   */
  const acceptFile = useCallback((targetFile: File) => {
    setFile(targetFile);
    setParseResult(null);
    setImportResult(null);
    void parseFile(targetFile);
  }, [parseFile]);

  /**
   * Compared by IDENTITY, not by name: re-rendering with the same File must not
   * re-parse it (and throw away an account the user has just chosen), while a
   * second file that happens to share a name still gets read.
   */
  const loadedInitialFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (!initialFile || loadedInitialFileRef.current === initialFile) return;
    loadedInitialFileRef.current = initialFile;
    acceptFile(initialFile);
  }, [acceptFile, initialFile]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    // Check file extension
    if (!uploadedFile.name.toLowerCase().endsWith('.qif')) {
      alert('Please select a QIF file');
      return;
    }

    acceptFile(uploadedFile);
  }, [acceptFile]);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];

    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.qif')) {
      acceptFile(droppedFile);
    }
  }, [acceptFile]);
  
  // Process import
  const processImport = useCallback(async () => {
    if (!parseResult || !file || !selectedAccountId) return;

    setIsProcessing(true);
    setProgress(null);

    try {
      const content = await file.text();
      const result: QIFImportResult = await qifImportService.importTransactions(
        content,
        selectedAccountId,
        skipDuplicates ? transactions : [],
        {
          categories,
          autoCategorize: true
        }
      );

      // The size of the job, known now that duplicates have been dropped and
      // before a single row is written. Nothing is claimed as inserted yet.
      if (isMountedRef.current) {
        setProgress({ inserted: 0, total: result.transactions.length });
      }

      // WRITE THE WHOLE FILE AS ONE UNIT.
      //
      // This dialog used to choose its own writer off `isUsingSupabase`: the
      // chunked cloud poster, or `for (…) await addTransaction(row)` — a
      // separate trip through the context for every row in the file. That loop
      // is why a QIF that failed on row 400 of 900 left 399 rows in the
      // register with nothing on screen but "Import Failed": there was no unit
      // for the import to be all of, so it could be part of one.
      //
      // One call, through the seam, whichever store this app is holding. Both
      // engines behind it are all-or-nothing per unit and both report what the
      // write itself confirmed:
      //   cloud — /api/data/import-transactions, one `import_transactions_atomic`
      //           per chunk, each its own database transaction;
      //   device — one IndexedDB `setMany` covering the rows AND the balance.
      //
      // `source: 'file'` is a statement about QIF rather than a default taken
      // for want of anything better: unlike an OFX statement, a QIF row carries
      // no id of its own, so there is nothing a store could key it by to
      // recognise a second copy. Importing the same file twice imports it
      // twice, and the duplicate check above the button is the only thing
      // between the user and a doubled month.
      const outcome: BulkImportResult = await dataPort.importTransactions(
        selectedAccountId,
        result.transactions,
        {
          source: 'file',
          // Fires between chunks where the store commits in chunks; a single
          // atomic write has no honest fraction and reports nothing until it
          // is done. Either way it can land after unmount.
          onProgress: p => { if (isMountedRef.current) setProgress(p); }
        }
      );

      // Re-read from the store rather than trusting the drafts: after this the
      // register shows what was actually written, including after a partial.
      await refreshAccountsAndTransactions();

      if (!outcome.complete) {
        throw new Error(
          `Imported ${outcome.inserted} of ${outcome.total} transactions before an error stopped the import.`
        );
      }

      const account = accounts.find(a => a.id === selectedAccountId) ?? null;

      if (!isMountedRef.current) return;
      setImportResult({
        success: true,
        // What the write confirmed, never the count the file offered.
        imported: outcome.inserted,
        duplicates: result.duplicates,
        invalidDates: result.invalidDates,
        matchedCategories: result.matchedCategories,
        unmatchedCategories: result.unmatchedCategories,
        complete: outcome.complete,
        account
      });
    } catch (error) {
      logger.error('Import error', error as Error);
      if (isMountedRef.current) {
        setImportResult({
          success: false,
          error: error instanceof Error ? error.message : 'Import failed'
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        setProgress(null);
      }
    }
  }, [accounts, categories, file, parseResult, refreshAccountsAndTransactions, selectedAccountId, skipDuplicates, transactions, logger]);
  
  // Reset modal
  const resetModal = useCallback(() => {
    setFile(null);
    setParseResult(null);
    setImportResult(null);
    setSelectedAccountId('');
    setProgress(null);
  }, []);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import QIF File" size="lg">
      {/* ModalBody, not a bare div: the Modal panel is overflow-hidden with a
          max height, and delegates scrolling to this element — a long preview
          list must scroll, not push the import button out of reach. */}
      <ModalBody>
        {!parseResult && !importResult && (
          <>
            {/* File Upload */}
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Upload QIF File
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Drag and drop your .qif file here, or click to browse
              </p>
              {/* sr-only, NOT hidden: display:none takes the input out of the
                  tab order entirely, and a <label> cannot hold focus in its
                  place — so the only way to reach this picker was a mouse.
                  Off-screen the input still takes focus, and focus-within
                  paints the ring on the button the user can actually see. */}
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary cursor-pointer focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                <FileTextIcon size={20} />
                Select QIF File
                <input
                  type="file"
                  accept=".qif"
                  onChange={handleFileUpload}
                  className="sr-only"
                  id="qif-upload"
                />
              </label>
            </div>
            
            {/* Info Box */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <InfoIcon className="text-blue-700 dark:text-blue-400 mt-0.5" size={20} />
                <div className="text-sm">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    About QIF Files
                  </h4>
                  <p className="text-blue-800 dark:text-blue-200 mb-2">
                    QIF (Quicken Interchange Format) is a simple text format for financial data.
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Widely supported by UK banks and financial software</li>
                    <li>• Simple format but no unique transaction IDs</li>
                    <li>• Requires manual account selection</li>
                    <li>• Best for one-time imports or initial setup</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Parse Results */}
        {parseResult && !importResult && (
          <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <FileTextIcon className="text-gray-600 dark:text-gray-400" size={24} />
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{file?.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {parseResult.transactions.length} transactions found
                  {parseResult.accountType && ` (Type: ${parseResult.accountType})`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Dates read as {parseResult.dateOrder === 'dmy' ? 'Day/Month/Year (UK)' : 'Month/Day/Year (US)'}
                  {parseResult.invalidDateCount > 0 &&
                    ` · ${parseResult.invalidDateCount} row${parseResult.invalidDateCount === 1 ? '' : 's'} skipped (unrecognised date)`}
                </p>
              </div>
            </div>
            
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Import to Account <span className="text-red-500">*</span>
              </label>
              <AccountSelector
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onAccountChange={setSelectedAccountId}
                placeholder="Search or select an account…"
                formatLabel={(account) => `${account.name} (${account.type})`}
                className="w-full px-3 py-2 h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                usePortal
                required
                ariaLabel="Import to Account"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                QIF files don't contain account information, so you need to select the destination account
              </p>
            </div>
            
            {/* Import Options */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Skip potential duplicates
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                Checks for transactions with the same date, amount, and payee
              </p>
            </div>
            
            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Preview (First 5 transactions)
              </h4>
              <div className="space-y-2 text-sm">
                {parseResult.transactions.slice(0, 5).map((trx, index) => (
                  <div key={index} className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{trx.date} - {trx.payee || trx.memo || 'No description'}</span>
                    <span className={trx.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(Math.abs(trx.amount))}
                    </span>
                  </div>
                ))}
                {parseResult.transactions.length > 5 && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                    ...and {parseResult.transactions.length - 5} more transactions
                  </p>
                )}
              </div>
            </div>
            
            {/* What the import is doing, from the click onwards — the file's
                own count until the write reports one of its own. */}
            {isProcessing && (
              <ImportProgress
                inserted={progress?.inserted ?? null}
                total={progress?.total ?? parseResult.transactions.length}
              />
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={resetModal}
                disabled={isProcessing}
                // Said, not just enforced: a dead button with no explanation is
                // indistinguishable from a broken one.
                title={isProcessing ? 'Import in progress' : undefined}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <LoadingButton
                isLoading={isProcessing}
                loadingText="Importing…"
                onClick={processImport}
                disabled={!selectedAccountId}
                className="flex items-center gap-2 px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50"
              >
                <UploadIcon size={20} />
                Import Transactions
              </LoadingButton>
            </div>
          </div>
        )}
        
        {/* Import Results */}
        {importResult && (
          <div className="text-center">
            {importResult.success ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                  <CheckIcon size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Import Successful!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Imported {importResult.imported} transactions to {importResult.account?.name}
                </p>
                
                {(importResult.duplicates ?? 0) > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
                    Skipped {importResult.duplicates} potential duplicate transactions
                  </p>
                )}

                {importResult.invalidDates > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
                    Skipped {importResult.invalidDates} row{importResult.invalidDates === 1 ? '' : 's'} with an unrecognised date
                  </p>
                )}

                {importResult.matchedCategories > 0 && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                    Matched {importResult.matchedCategories.toLocaleString()} transaction{importResult.matchedCategories === 1 ? '' : 's'} to your existing categories
                  </p>
                )}

                {importResult.unmatchedCategories.length > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-left max-w-md mx-auto bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                      {importResult.unmatchedCategories.length} categor{importResult.unmatchedCategories.length === 1 ? 'y' : 'ies'} in the file don’t exist in the app yet:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {importResult.unmatchedCategories.slice(0, 8).map(c => (
                        <li key={c.name}>{c.name} <span className="text-gray-400">({c.count})</span></li>
                      ))}
                      {importResult.unmatchedCategories.length > 8 && (
                        <li className="list-none text-gray-400">…and {importResult.unmatchedCategories.length - 8} more</li>
                      )}
                    </ul>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Those transactions were left uncategorised. Categorise one
                      of a payee's rows and payee memory fills the rest of that
                      payee automatically.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                  <AlertCircleIcon size={32} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Import Failed
                </h3>
                <p className="text-red-600 dark:text-red-400 mb-6">
                  {importResult.error}
                </p>
              </>
            )}
            
            <div className="flex justify-center gap-3">
              <button
                onClick={resetModal}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                <RefreshCwIcon size={20} />
                Import Another File
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
