import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { UploadIcon } from './icons/UploadIcon';
import { FileTextIcon } from './icons/FileTextIcon';
import { AlertCircleIcon } from './icons/AlertCircleIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { InfoIcon } from './icons/InfoIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { parseMNY, parseMBF, applyMappingToData, type FieldMapping } from '../utils/mnyParser';
import { parseQIF as enhancedParseQIF } from '../utils/qifParser';
import { ofxImportService } from '../services/ofxImportService';
import MnyMappingModal from './MnyMappingModal';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { createScopedLogger } from '../loggers/scopedLogger';

interface ImportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedTransaction {
  date: Date;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  category: string;
  payee?: string;
  /** Parser-resolved source account; used to route the import to the right account. */
  accountName?: string;
  /** Carried through from the file where the parser produced one (OFX FITID). */
  notes?: string;
  cleared?: boolean;
  /**
   * The bank's own position for this row within its statement. Kept because it
   * is the only record of which of a day's payments came first. Null carries
   * "the file had no order to give", exactly as Transaction stores it.
   */
  statementSequence?: number | null;
}

interface ParsedAccount {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment';
  balance: number;
}

interface ParsedData {
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
  warning?: string;
  rawData?: Array<Record<string, unknown>>;
  needsMapping?: boolean;
  /**
   * How many rows the register already held and this import left out.
   *
   * `undefined` means the format's parser does not look — which is a different
   * statement from "it looked and found none", and the note shown before the
   * Import button says the right one of those two.
   */
  duplicatesSkipped?: number;
}

export default function ImportDataModal({ isOpen, onClose }: ImportDataModalProps): React.JSX.Element {
  const { addAccount, addTransaction, accounts, transactions, categories } = useApp();
  const logger = useMemo(() => createScopedLogger('ImportDataModal'), []);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<ParsedData | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [rawMnyData, setRawMnyData] = useState<Array<Record<string, unknown>>>([]);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  /**
   * OFX, read by the one OFX reader the app has.
   *
   * This used to be a second, hand-rolled parser living in this file, and it
   * had drifted badly: it read an EMPTY <MEMO></MEMO> as the literal text
   * "</MEMO>" and described the transaction that way, it put the OFX TRNTYPE
   * ("DEBIT") into the category field, it took the FIRST <BALAMT> in the file —
   * which on a card statement is the remaining credit, not the debt — and it
   * detected no duplicates at all, so the same statement twice was the same
   * payment twice.
   *
   * The account behaviour is deliberately kept: this modal is the Legacy
   * Import, and its job is to bring a file in whether or not the account
   * already exists. So a statement that matches an account the user holds is
   * routed to THAT account, and one that matches nothing still creates the
   * account it describes, exactly as before.
   */
  const parseOFXFile = async (content: string): Promise<ParsedData> => {
    logger.info?.('Using OFX import service');
    const result = await ofxImportService.importTransactions(content, accounts, transactions, {
      // This modal writes straight through with no review step, so a row the
      // register already holds must not be written a second time.
      skipDuplicates: true,
      categories,
      autoCategorize: true
    });

    // A matched account is reused by name below; an unmatched one is created.
    const accountName = result.matchedAccount?.name
      ?? `Account ${result.ofxAccount.accountId}`;
    const ofxType = result.ofxAccount.accountType.toLowerCase();

    const account: ParsedAccount = {
      name: accountName,
      type: ofxType.includes('credit') ? 'credit'
        : ofxType.includes('saving') ? 'savings'
        : 'checking',
      // The statement's LEDGERBAL. Only ever used for an account being
      // created — a matched account keeps the balance its ledger says.
      balance: result.statementBalance?.amount ?? 0
    };

    const unreadable = result.unreadableRows;
    return {
      accounts: [account],
      transactions: result.transactions.map((t): ParsedTransaction => ({
        date: t.date,
        amount: t.amount,
        description: t.description,
        // The OFX reader only ever resolves income or expense.
        type: t.type === 'income' ? 'income' : 'expense',
        category: t.category,
        accountName,
        notes: t.notes,
        cleared: t.cleared,
        statementSequence: t.statementSequence
      })),
      duplicatesSkipped: result.duplicates,
      ...(unreadable > 0
        ? {
            warning: unreadable === 1
              ? 'One row in this file could not be read and will be missing from the register.'
              : `${unreadable} rows in this file could not be read and will be missing from the register.`
          }
        : {})
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setStatus('idle');
    setMessage('');
    setParsing(true);
    
    const fileName = selectedFile.name.toLowerCase();
      logger.info?.('Processing file', { fileName, size: selectedFile.size });
    
    try {
      let parsed: ParsedData | null = null;
      
      if (fileName.endsWith('.mny')) {
        logger.info?.('Detected MNY file');
        setMessage('Parsing Money database file... This may take a moment...');
        const arrayBuffer = await selectedFile.arrayBuffer();
        parsed = await parseMNY(arrayBuffer);
        
        // Check if we need manual mapping
        if (parsed.needsMapping && parsed.rawData) {
          setRawMnyData(parsed.rawData);
          setShowMappingModal(true);
          setParsing(false);
          return;
        }
      } else if (fileName.endsWith('.mbf')) {
        logger.info?.('Detected MBF backup file');
        setMessage('Parsing Money backup file... This may take a moment...');
        const arrayBuffer = await selectedFile.arrayBuffer();
        parsed = await parseMBF(arrayBuffer);
        
        // Check if we need manual mapping
        if (parsed.needsMapping && parsed.rawData) {
          setRawMnyData(parsed.rawData);
          setShowMappingModal(true);
          setParsing(false);
          return;
        }
      } else if (fileName.endsWith('.qif')) {
        logger.info?.('Detected QIF file');
        setMessage('Parsing QIF file...');
        const content = await selectedFile.text();
        logger.debug?.('QIF file inspection', { length: content.length, preview: content.substring(0, 200) });
        
        // Use the enhanced QIF parser
        parsed = enhancedParseQIF(content);
      } else if (fileName.endsWith('.ofx')) {
        logger.info?.('Detected OFX file');
        setMessage('Parsing OFX file...');
        const content = await selectedFile.text();
        parsed = await parseOFXFile(content);
      } else {
        throw new Error('Unsupported file format. Please use .mny, .mbf, .qif, or .ofx files.');
      }
      
      if (parsed) {
        logger.info?.('Parse complete', { accounts: parsed.accounts.length, transactions: parsed.transactions.length });
        setPreview(parsed);
        if (parsed.warning) {
          setMessage(parsed.warning);
          setStatus('error');
        } else {
          // Rows the register already held are named for what happened to
          // them, not merely counted: they are not in the number beside them.
          const alreadyHeld = parsed.duplicatesSkipped
            ? ` — ${parsed.duplicatesSkipped} already in this account, left out`
            : '';
          setMessage(
            `Found ${parsed.accounts.length} accounts and ${parsed.transactions.length} transactions${alreadyHeld}`
          );
          setStatus('idle');
        }
      }
    } catch (error) {
      logger.error('Parse error', error as Error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to parse file');
      setPreview(null);
    } finally {
      setParsing(false);
    }
  };

  const handleMappingComplete = (mapping: FieldMapping, data: Array<Record<string, unknown>>) => {
    logger.info?.('Applying mapping to data');
    const result = applyMappingToData(data, mapping);
    
    setPreview({
      accounts: result.accounts,
      transactions: result.transactions
    });
    setMessage(`Mapped ${result.accounts.length} accounts and ${result.transactions.length} transactions`);
    setShowMappingModal(false);
  };

  // Retired 2026-08-07: the "Test Data Detected — clear it first?" prompt that
  // used to sit in front of this. It read a flag nothing could keep true, and
  // its "Clear & Import" button called a context reset that only emptied React
  // state, so on a cloud login the data it promised to clear came straight back
  // on the next load. What replaces it is the note in the dialog body, which
  // describes what this import actually does to existing data.
  const handleImport = async () => {
    if (!preview) return;
    importDataToApp();
  };

  const importDataToApp = async () => {
    if (!preview) return;
    
    setImporting(true);
    try {
      logger.info?.('Starting import', { accounts: preview.accounts.length, transactions: preview.transactions.length });
      
      // Import accounts first
      const accountMap = new Map<string, string>();
      
      for (const account of preview.accounts) {
        const existingAccount = accounts.find(a => 
          a.name.toLowerCase() === account.name.toLowerCase()
        );
        
        if (existingAccount) {
          logger.warn?.('Account already exists', { accountName: account.name });
          accountMap.set(account.name, existingAccount.id);
          continue;
        }
        
        const newAccount = {
          name: account.name,
          type: (account.type === 'checking' ? 'current' : account.type) as 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'other',
          balance: account.balance,
          currency: 'GBP',
          institution: 'Imported',
          lastUpdated: new Date()
        };
        logger.info?.('Adding account', newAccount);
        const createdAccount = await addAccount(newAccount);
        accountMap.set(account.name, createdAccount.id);
      }

      // Import transactions, routing each to the account the parser resolved
      // for it. Writing everything to accounts[0] double-counts multi-account
      // imports; fall back to the first account only when unresolvable.
      const defaultAccountId = accounts[0]?.id || 'default';
      logger.info?.('Importing transactions', { count: preview.transactions.length });

      for (const transaction of preview.transactions) {
        const { accountName, ...transactionFields } = transaction;
        const resolvedAccountId =
          (accountName ? accountMap.get(accountName) : undefined) ?? defaultAccountId;
        addTransaction({
          ...transactionFields,
          accountId: resolvedAccountId,
        });
      }
      
      setStatus('success');
      setMessage(`Successfully imported ${preview.accounts.length} accounts and ${preview.transactions.length} transactions`);
      
      closeTimerRef.current = setTimeout(() => {
        onClose();
        setFile(null);
        setPreview(null);
        setStatus('idle');
        setMessage('');
      }, 2000);
    } catch (error) {
      logger.error('Import error', error as Error);
      setStatus('error');
      setMessage('Failed to import data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Import Financial Data" size="xl">
        <ModalBody>

          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Import your financial data from Microsoft Money or other financial software. 
              Supported formats:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-4">
              <li><strong>QIF</strong> - Quicken Interchange Format (recommended for Money users)</li>
              <li><strong>OFX</strong> - Open Financial Exchange</li>
              <li><strong>MNY</strong> - Microsoft Money database files (with manual mapping)</li>
              <li><strong>MBF</strong> - Microsoft Money backup files (with manual mapping)</li>
            </ul>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <InfoIcon className="text-blue-700 dark:text-blue-400 mt-0.5" size={20} />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">Money File Import:</p>
                  <p>For Money .mny or .mbf files, we'll show you the data and let you tell us what each column represents.</p>
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              {parsing ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Parsing file...</p>
                </>
              ) : (
                <>
                  <UploadIcon className="mx-auto text-gray-400 mb-4" size={48} />
                  <label className="cursor-pointer">
                    <span className="bg-[#1a2332] text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors inline-block">
                      Choose File
                    </span>
                    <input
                      type="file"
                      accept=".mny,.mbf,.qif,.ofx,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={parsing}
                    />
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {file ? file.name : 'No file selected'}
                  </p>
                </>
              )}
            </div>
          </div>

          {preview && preview.warning && (
            <div className="mb-4 p-3 rounded-lg flex items-start gap-2 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">
              <AlertTriangleIcon size={20} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">Import Notice</p>
                <p className="text-sm">{preview.warning}</p>
              </div>
            </div>
          )}

          {preview && (preview.accounts.length > 0 || preview.transactions.length > 0) && (
            <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2 dark:text-white">Preview</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Accounts found:</p>
                  <p className="font-semibold dark:text-white">{preview.accounts.length}</p>
                  {preview.accounts.slice(0, 5).map((acc, i) => (
                    <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
                      • {acc.name} ({acc.type})
                    </p>
                  ))}
                  {preview.accounts.length > 5 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      • ... and {preview.accounts.length - 5} more
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Transactions found:</p>
                  <p className="font-semibold dark:text-white">{preview.transactions.length}</p>
                  {preview.transactions.length > 0 && (
                    <>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Date range: {preview.transactions[0].date.toLocaleDateString()} - {preview.transactions[preview.transactions.length - 1].date.toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        First: {preview.transactions[0].description.substring(0, 30)}...
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* The one thing worth saying before the button is pressed: this
              importer only ever ADDS, and accounts already present by name are
              reused. Whether the same file twice records the same payment twice
              now depends on the format — OFX goes through the shared reader,
              which recognises a row the register already holds; the rest do
              not look. Saying "duplicates are not detected" for all of them
              would be telling one half of the users something untrue. */}
          {preview && preview.transactions.length > 0 && (
            <div className="mb-4 p-3 rounded-lg flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              <AlertTriangleIcon size={20} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold mb-1">These are added to what you already have</p>
                {preview.duplicatesSkipped === undefined ? (
                  <p>Nothing is replaced or deleted. Duplicates are not detected on this
                    path, so importing the same file twice records every payment twice —
                    use Settings → Data Management → Find Duplicates afterwards if you are unsure.</p>
                ) : (
                  <p>Nothing is replaced or deleted. Rows this account already holds have
                    been left out, so importing the same statement again will not record
                    the same payment twice.</p>
                )}
              </div>
            </div>
          )}

          {message && !preview?.warning && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              status === 'success' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
              status === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
              'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            }`}>
              {status === 'success' ? <CheckCircleIcon size={20} /> :
               status === 'error' ? <AlertCircleIcon size={20} /> :
               <FileTextIcon size={20} />}
              <span>{message}</span>
            </div>
          )}

        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              disabled={parsing || importing}
              className="flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!preview || importing || parsing || preview.accounts.length === 0}
              className={`flex-1 justify-center px-4 py-2 rounded-lg ${
                preview && !importing && !parsing && preview.accounts.length > 0
                  ? 'bg-[#1a2332] text-white hover:bg-secondary'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {importing ? 'Importing...' : 'Import Data'}
            </button>
          </div>
        </ModalFooter>
      </Modal>

      <MnyMappingModal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        rawData={rawMnyData}
        onMappingComplete={handleMappingComplete}
      />
    </>
  );
}
