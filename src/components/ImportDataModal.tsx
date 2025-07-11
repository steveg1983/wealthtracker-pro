import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

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
  const { addAccount, addTransaction, accounts } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{
    accounts: ParsedAccount[];
    transactions: ParsedTransaction[];
  } | null>(null);

  // Parse MBF file format (Microsoft Money Backup)
  const parseMBF = async (arrayBuffer: ArrayBuffer): Promise<{
    accounts: ParsedAccount[];
    transactions: ParsedTransaction[];
  }> => {
    const dataView = new DataView(arrayBuffer);
    const transactions: ParsedTransaction[] = [];
    const accountsMap = new Map<string, ParsedAccount>();
    
    try {
      // MBF files have a specific structure
      // Skip header (first 512 bytes typically contain file metadata)
      let offset = 512;
      
      // Read accounts section
      // Look for account markers (simplified parsing)
      const decoder = new TextDecoder('windows-1252');
      const fullData = new Uint8Array(arrayBuffer);
      
      // Convert to string for pattern matching (simplified approach)
      let dataString = '';
      for (let i = 0; i < fullData.length; i++) {
        if (fullData[i] >= 32 && fullData[i] <= 126) {
          dataString += String.fromCharCode(fullData[i]);
        } else {
          dataString += ' ';
        }
      }
      
      // Extract account names (look for patterns)
      const accountPattern = /ACCT([^\\]+)/g;
      let accountMatch;
      let accountIndex = 0;
      
      while ((accountMatch = accountPattern.exec(dataString)) !== null) {
        const accountName = accountMatch[1].trim().replace(/[^\w\s-]/g, '');
        if (accountName.length > 2 && accountName.length < 50) {
          accountsMap.set(accountName, {
            name: accountName,
            type: accountName.toLowerCase().includes('credit') ? 'credit' :
                  accountName.toLowerCase().includes('saving') ? 'savings' :
                  accountName.toLowerCase().includes('loan') ? 'loan' :
                  accountName.toLowerCase().includes('invest') ? 'investment' : 'checking',
            balance: 0
          });
          accountIndex++;
        }
      }
      
      // Extract transactions (look for date patterns followed by amounts)
      // MBF stores dates as days since 1900
      const baseDate = new Date(1900, 0, 1);
      
      // Look for transaction blocks
      for (let i = 0; i < arrayBuffer.byteLength - 16; i++) {
        // Check for potential date value (4 bytes)
        const possibleDays = dataView.getInt32(i, true);
        
        // Valid date range check (between 1990 and 2030)
        if (possibleDays > 32874 && possibleDays < 51000) {
          // Check if next 8 bytes could be an amount (stored as cents)
          const possibleAmount = dataView.getInt32(i + 8, true);
          
          if (possibleAmount !== 0 && Math.abs(possibleAmount) < 100000000) {
            const transDate = new Date(baseDate);
            transDate.setDate(transDate.getDate() + possibleDays);
            
            // Extract description (look ahead for text)
            let description = '';
            let descOffset = i + 16;
            while (descOffset < i + 100 && descOffset < arrayBuffer.byteLength) {
              const byte = fullData[descOffset];
              if (byte >= 32 && byte <= 126) {
                description += String.fromCharCode(byte);
              } else if (description.length > 0) {
                break;
              }
              descOffset++;
            }
            
            if (description.length > 2) {
              transactions.push({
                date: transDate,
                amount: Math.abs(possibleAmount / 100), // Convert from cents
                description: description.trim(),
                type: possibleAmount < 0 ? 'expense' : 'income',
                category: 'Imported'
              });
            }
          }
        }
      }
      
      // If no accounts found, create a default one
      if (accountsMap.size === 0) {
        accountsMap.set('Money Import', {
          name: 'Money Import',
          type: 'checking',
          balance: 0
        });
      }
      
      // Calculate account balances from transactions
      const accountsArray = Array.from(accountsMap.values());
      if (accountsArray.length > 0 && transactions.length > 0) {
        // Distribute transaction totals across accounts
        const totalIncome = transactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = transactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        accountsArray[0].balance = totalIncome - totalExpenses;
      }
      
      return {
        accounts: accountsArray,
        transactions: transactions.filter(t => !isNaN(t.date.getTime()))
      };
    } catch (error) {
      console.error('Error parsing MBF file:', error);
      throw new Error('Failed to parse Microsoft Money file. The file may be corrupted or in an unsupported format.');
    }
  };

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
    
    try {
      let parsed;
      
      if (selectedFile.name.toLowerCase().endsWith('.mbf')) {
        // Handle Microsoft Money backup file
        const arrayBuffer = await selectedFile.arrayBuffer();
        parsed = await parseMBF(arrayBuffer);
      } else if (selectedFile.name.toLowerCase().endsWith('.qif')) {
        const content = await selectedFile.text();
        parsed = parseQIF(content);
      } else if (selectedFile.name.toLowerCase().endsWith('.ofx')) {
        const content = await selectedFile.text();
        parsed = parseOFX(content);
      } else {
        throw new Error('Unsupported file format. Please use .mbf, .qif, or .ofx files.');
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
        // Check if account already exists
        const existingAccount = accounts.find(a => 
          a.name.toLowerCase() === account.name.toLowerCase()
        );
        
        if (existingAccount) {
          accountMap.set(account.name, existingAccount.id);
        } else {
          const newAccount = {
            name: account.name,
            type: account.type,
            balance: account.balance,
            currency: 'GBP',
            institution: 'Microsoft Money Import',
            lastUpdated: new Date()
          };
          addAccount(newAccount);
          // In a real app, we'd get the ID from the addAccount return value
          accountMap.set(account.name, `imported-${Date.now()}`);
        }
      }
      
      // Import transactions
      const defaultAccountId = accounts[0]?.id || 'default';
      
      for (const transaction of preview.transactions) {
        addTransaction({
          ...transaction,
          accountId: defaultAccountId, // Use first account or default
        });
      }
      
      setStatus('success');
      setMessage(`Successfully imported ${preview.transactions.length} transactions`);
      
      setTimeout(() => {
        onClose();
        setFile(null);
        setPreview(null);
        setStatus('idle');
        setMessage('');
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

        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Import your financial data from Microsoft Money or other financial software. 
            Supported formats:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-4">
            <li><strong>MBF</strong> - Microsoft Money Backup files</li>
            <li><strong>QIF</strong> - Quicken Interchange Format</li>
            <li><strong>OFX</strong> - Open Financial Exchange</li>
          </ul>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <label className="cursor-pointer">
              <span className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors inline-block">
                Choose File
              </span>
              <input
                type="file"
                accept=".mbf,.qif,.ofx"
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

        {message && (
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
      </div>
    </div>
  );
}
