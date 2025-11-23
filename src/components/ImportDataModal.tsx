import { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { UploadIcon } from './icons/UploadIcon';
import { FileTextIcon } from './icons/FileTextIcon';
import { AlertCircleIcon } from './icons/AlertCircleIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { InfoIcon } from './icons/InfoIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { parseMNY, parseMBF, applyMappingToData, type FieldMapping } from '../utils/mnyParser';
import { parseQIF as enhancedParseQIF } from '../utils/qifParser';
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
}

export default function ImportDataModal({ isOpen, onClose }: ImportDataModalProps): React.JSX.Element {
  const { addAccount, addTransaction, accounts, hasTestData, clearAllData } = useApp();
  const logger = useMemo(() => createScopedLogger('ImportDataModal'), []);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<ParsedData | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [rawMnyData, setRawMnyData] = useState<Array<Record<string, unknown>>>([]);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);

  // Parse OFX file format
  const parseOFX = (content: string): ParsedData => {
    logger.info?.('Using OFX parser');
    const transactions: ParsedTransaction[] = [];
    const accountsMap = new Map<string, ParsedAccount>();
    
    // Extract account info
    const accountMatch = content.match(/<ACCTID>([^<]+)/);
    const accountTypeMatch = content.match(/<ACCTTYPE>([^<]+)/);
    const balanceMatch = content.match(/<BALAMT>([^<]+)/);
    
    const accountName = accountMatch ? `Account ${accountMatch[1]}` : 'Imported Account';
    const accountType = accountTypeMatch?.[1]?.toLowerCase() || 'checking';
    const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;
    
    accountsMap.set(accountName, {
      name: accountName,
      type: accountType.includes('credit') ? 'credit' : 
            accountType.includes('saving') ? 'savings' : 'checking',
      balance
    });
    
    // Extract transactions
    const transactionRegex = /<STMTTRN>[\s\S]*?<\/STMTTRN>/g;
    const transactionMatches = content.match(transactionRegex) || [];
    
    for (const trans of transactionMatches) {
      const typeMatch = trans.match(/<TRNTYPE>([^<]+)/);
      const dateMatch = trans.match(/<DTPOSTED>([^<]+)/);
      const amountMatch = trans.match(/<TRNAMT>([^<]+)/);
      const nameMatch = trans.match(/<NAME>([^<]+)/);
      const memoMatch = trans.match(/<MEMO>([^<]+)/);
      
      if (dateMatch && amountMatch) {
        const dateStr = dateMatch[1];
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));
        
        const amount = parseFloat(amountMatch[1]);
        const description = nameMatch?.[1] || memoMatch?.[1] || 'Imported transaction';
        const type = amount < 0 ? 'expense' : 'income';
        
        transactions.push({
          date: new Date(year, month - 1, day),
          amount: Math.abs(amount),
          description,
          type,
          category: typeMatch?.[1] || 'Other'
        });
      }
    }
    
    return {
      accounts: Array.from(accountsMap.values()),
      transactions
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
        parsed = parseOFX(content);
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
          setMessage(`Found ${parsed.accounts.length} accounts and ${parsed.transactions.length} transactions`);
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

  const handleClearAndImport = async () => {
    // Clear all data first
    clearAllData();
    setShowTestDataWarning(false);
    
    // Small delay to ensure state updates and localStorage is cleared
    setTimeout(() => {
      // Now import the data - hasTestData will be false after clearAllData
      if (preview) {
        setImporting(true);
        importDataToApp();
      }
    }, 100);
  };

  const handleContinueWithTestData = () => {
    setShowTestDataWarning(false);
    importDataToApp();
  };

  const handleImport = async () => {
    if (!preview) return;
    
    // Check if we have test data and need to show warning
    if (hasTestData && !showTestDataWarning) {
      setShowTestDataWarning(true);
      return;
    }
    
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
        addAccount(newAccount);
        accountMap.set(account.name, `imported-${Date.now()}`);
      }
      
      // Import transactions
      const defaultAccountId = accounts[0]?.id || 'default';
      logger.info?.('Importing transactions', { count: preview.transactions.length });
      
      for (const transaction of preview.transactions) {
        addTransaction({
          ...transaction,
          accountId: defaultAccountId,
        });
      }
      
      setStatus('success');
      setMessage(`Successfully imported ${preview.accounts.length} accounts and ${preview.transactions.length} transactions`);
      
      setTimeout(() => {
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
      <Modal isOpen={isOpen} onClose={() => {
        onClose();
        setShowTestDataWarning(false);
      }} title="Import Financial Data" size="xl">
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
                <InfoIcon className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
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
                    <span className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors inline-block">
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

          {message && !preview?.warning && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              status === 'success' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
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
              onClick={() => {
                onClose();
                setShowTestDataWarning(false);
              }}
              disabled={parsing || importing}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!preview || importing || parsing || preview.accounts.length === 0}
              className={`flex-1 px-4 py-2 rounded-lg ${
                preview && !importing && !parsing && preview.accounts.length > 0
                  ? 'bg-primary text-white hover:bg-secondary'
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

      {/* Test Data Warning Dialog */}
      {showTestDataWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangleIcon className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Test Data Detected</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You currently have test data loaded in your application. You're about to import real bank data.
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Would you like to:
            </p>
            <div className="space-y-3 mb-6">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="font-medium text-blue-800 dark:text-blue-200">Clear test data first (Recommended)</p>
                <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                  Remove all test data and start fresh with your real bank data
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium text-gray-800 dark:text-gray-200">Continue with test data</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Mix your real bank data with the existing test data
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTestDataWarning(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleContinueWithTestData}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Continue
              </button>
              <button
                onClick={handleClearAndImport}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
              >
                Clear & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
