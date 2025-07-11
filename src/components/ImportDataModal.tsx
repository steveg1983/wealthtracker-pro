import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { parseMNY } from "../utils/mnyParser";
import { X, Upload, FileText, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { parseMBF } from '../utils/mbfParser';

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
}

interface ParsedAccount {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment';
  balance: number;
}

export default function ImportDataModal({ isOpen, onClose }: ImportDataModalProps) {
  const { addAccount, addTransaction, accounts, clearAllData } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{
    accounts: ParsedAccount[];
    transactions: ParsedTransaction[];
  } | null>(null);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [showMBFHelp, setShowMBFHelp] = useState(false);

  // Parse QIF file format
  const parseQIF = (content: string): { 
    accounts: ParsedAccount[]; 
    transactions: ParsedTransaction[] 
  } => {
    const lines = content.split('\n');
    const transactions: ParsedTransaction[] = [];
    const accountsMap = new Map<string, ParsedAccount>();
    
    let currentTransaction: any = {};
    let currentAccount = 'Default Account';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '!Account') {
        // Account section
        i++;
        while (i < lines.length && !lines[i].startsWith('!')) {
          const accountLine = lines[i].trim();
          if (accountLine.startsWith('N')) {
            currentAccount = accountLine.substring(1);
          }
          if (accountLine.startsWith('T')) {
            const type = accountLine.substring(1).toLowerCase();
            accountsMap.set(currentAccount, {
              name: currentAccount,
              type: type.includes('credit') ? 'credit' : 
                    type.includes('saving') ? 'savings' : 
                    type.includes('invest') ? 'investment' : 'checking',
              balance: 0
            });
          }
          i++;
        }
        i--; // Back up one line
      } else if (line === '!Type:Bank' || line === '!Type:CCard' || line === '!Type:Cash') {
        // Transaction section
        continue;
      } else if (line.startsWith('^')) {
        // End of transaction
        if (currentTransaction.date && currentTransaction.amount !== undefined) {
          transactions.push({
            date: currentTransaction.date,
            amount: Math.abs(currentTransaction.amount),
            description: currentTransaction.payee || currentTransaction.memo || 'Imported transaction',
            type: currentTransaction.amount < 0 ? 'expense' : 'income',
            category: currentTransaction.category || 'Other'
          });
        }
        currentTransaction = {};
      } else if (line.startsWith('D')) {
        // Date
        const dateStr = line.substring(1);
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
          const month = parseInt(parts[0]);
          const day = parseInt(parts[1]);
          const year = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
          currentTransaction.date = new Date(year, month - 1, day);
        }
      } else if (line.startsWith('T') || line.startsWith('U')) {
        // Amount
        const amountStr = line.substring(1).replace(/[,$]/g, '');
        currentTransaction.amount = parseFloat(amountStr);
      } else if (line.startsWith('P')) {
        // Payee
        currentTransaction.payee = line.substring(1);
      } else if (line.startsWith('M')) {
        // Memo
        currentTransaction.memo = line.substring(1);
      } else if (line.startsWith('L')) {
        // Category
        currentTransaction.category = line.substring(1).replace(/[\[\]]/g, '');
      }
    }
    
    // If no accounts were defined, create a default one
    if (accountsMap.size === 0) {
      accountsMap.set('Imported Account', {
        name: 'Imported Account',
        type: 'checking',
        balance: 0
      });
    }
    
    return {
      accounts: Array.from(accountsMap.values()),
      transactions: transactions.filter(t => !isNaN(t.date.getTime()))
    };
  };

  // Parse OFX file format
  const parseOFX = (content: string): { 
    accounts: ParsedAccount[]; 
    transactions: ParsedTransaction[] 
  } => {
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
    setShowOverwriteWarning(false);
    setShowMBFHelp(false);
    
    try {
      let parsed;
      
      if (selectedFile.name.toLowerCase().endsWith('.mny')) {
        // Handle Microsoft Money database file
        const arrayBuffer = await selectedFile.arrayBuffer();
        parsed = await parseMNY(arrayBuffer);
      } else if (selectedFile.name.toLowerCase().endsWith('.qif')) {
      } else if (selectedFile.name.toLowerCase().endsWith('.qif')) {
        const content = await selectedFile.text();
        parsed = parseQIF(content);
      } else if (selectedFile.name.toLowerCase().endsWith('.ofx')) {
        const content = await selectedFile.text();
        parsed = parseOFX(content);
      } else {
        throw new Error('Unsupported file format. Please use .qif or .ofx files.');
      }
      
      setPreview(parsed);
      setMessage(`Found ${parsed.accounts.length} accounts and ${parsed.transactions.length} transactions`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to parse file');
      setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    
    setImporting(true);
    try {
      // Import accounts first
      const accountMap = new Map<string, string>();
      
      for (const account of preview.accounts) {
        const existingAccount = accounts.find(a => 
          a.name.toLowerCase() === account.name.toLowerCase()
        );
        
        if (existingAccount) {
          accountMap.set(account.name, existingAccount.id);
          continue;
        }
        
        const newAccount = {
          name: account.name,
          type: account.type,
          balance: account.balance,
          currency: 'GBP',
          institution: 'Imported',
          lastUpdated: new Date()
        };
        addAccount(newAccount);
        accountMap.set(account.name, `imported-${Date.now()}`);
      }
      
      // Import transactions
      const defaultAccountId = accounts[0]?.id || 'default';
      
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
        setShowMBFHelp(false);
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage('Failed to import data');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Import Financial Data</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {!showMBFHelp ? (
          <>
            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Import your financial data from Microsoft Money or other financial software. 
                Supported formats:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-4">
                <li><strong>MNY</strong> - Microsoft Money database files</li>
                <li><strong>QIF</strong> - Quicken Interchange Format (recommended for Money users)</li>
                <li><strong>OFX</strong> - Open Financial Exchange</li>
              </ul>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-semibold mb-1">Microsoft Money Users:</p>
                    <p>For best results, export your data as QIF from within Money:</p>
                    <ol className="list-decimal list-inside mt-2 ml-2">
                      <li>Open Microsoft Money Sunset</li>
                      <li>Go to File → Export</li>
                      <li>Choose "Loose QIF" format</li>
                      <li>Select date range and accounts</li>
                      <li>Save and import the QIF file here</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <label className="cursor-pointer">
                  <span className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors inline-block">
                    Choose File
                  </span>
                  <input
                    type="file"
                    accept=".mny,.qif,.ofx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {file ? file.name : 'No file selected'}
                </p>
              </div>
            </div>

            {preview && (
              <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold mb-2 dark:text-white">Preview</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Accounts found:</p>
                    <p className="font-semibold dark:text-white">{preview.accounts.length}</p>
                    {preview.accounts.slice(0, 3).map((acc, i) => (
                      <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
                        • {acc.name} ({acc.type})
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Transactions found:</p>
                    <p className="font-semibold dark:text-white">{preview.transactions.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Date range: {preview.transactions.length > 0 
                        ? `${preview.transactions[0].date.toLocaleDateString()} - 
                           ${preview.transactions[preview.transactions.length - 1].date.toLocaleDateString()}`
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {message && !showMBFHelp && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                status === 'success' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                status === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              }`}>
                {status === 'success' ? <CheckCircle size={20} /> :
                 status === 'error' ? <AlertCircle size={20} /> :
                 <FileText size={20} />}
                <span>{message}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!preview || importing}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  preview && !importing
                    ? 'bg-primary text-white hover:bg-secondary'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {importing ? 'Importing...' : 'Import Data'}
              </button>
            </div>
          </>
        ) : (
          /* MBF Help Information */
          <div className="text-center">
            <AlertCircle className="mx-auto text-orange-500 mb-4" size={64} />
            <h3 className="text-xl font-semibold mb-4 dark:text-white">
              Microsoft Money MBF Files
            </h3>
            <div className="text-left mb-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                MBF backup files from Microsoft Money are often encrypted or use proprietary compression that makes them difficult to import directly.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                <strong>We recommend using QIF export instead:</strong>
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>Open your data in Microsoft Money Sunset (free edition)</li>
                  <li>Go to <strong>File → Export</strong></li>
                  <li>Choose <strong>"Loose QIF"</strong> as the export type</li>
                  <li>Select <strong>"All Accounts"</strong> to export everything</li>
                  <li>Choose your date range (or leave blank for all dates)</li>
                  <li>Save the QIF file and import it here</li>
                </ol>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                QIF files contain the same data as MBF files but in a standard format that we can reliably import.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMBFHelp(false);
                  setFile(null);
                  setMessage('');
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
              >
                Choose Different File
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
