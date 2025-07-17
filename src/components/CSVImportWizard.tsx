import React, { useState, useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { Modal } from './common/Modal';
import DuplicateDetection from './DuplicateDetection';
import { 
  UploadIcon, 
  FileTextIcon, 
  CheckCircleIcon, 
  AlertCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  DatabaseIcon,
  MagicWandIcon,
  SaveIcon,
  SettingsIcon
} from './icons';
import { toDecimal } from '../utils/decimal';
import type { Transaction, Account } from '../types';

interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

interface ColumnMapping {
  date: number | null;
  description: number | null;
  amount: number | null;
  category?: number | null;
  payee?: number | null;
  balance?: number | null;
  debit?: number | null;
  credit?: number | null;
}

interface BankTemplate {
  id: string;
  name: string;
  description: string;
  dateFormat: string;
  mapping: ColumnMapping;
  skipRows: number;
  invertAmount?: boolean;
}

const BANK_TEMPLATES: BankTemplate[] = [
  // UK Banks
  {
    id: 'barclays-uk',
    name: 'Barclays',
    description: 'Barclays UK CSV export',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 5,
      category: 4,
      debit: 6,
      credit: 7,
      balance: 8
    },
    skipRows: 1
  },
  {
    id: 'hsbc-uk',
    name: 'HSBC UK',
    description: 'HSBC statement download',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 1,
      amount: 2
    },
    skipRows: 1,
    invertAmount: true
  },
  {
    id: 'lloyds',
    name: 'Lloyds Bank',
    description: 'Lloyds/Halifax/Bank of Scotland',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 4,
      debit: 5,
      credit: 6,
      balance: 7
    },
    skipRows: 1
  },
  {
    id: 'natwest',
    name: 'NatWest/RBS',
    description: 'NatWest & Royal Bank of Scotland',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 2,
      debit: 3,
      credit: 4,
      balance: 5
    },
    skipRows: 1
  },
  {
    id: 'santander-uk',
    name: 'Santander UK',
    description: 'Santander UK CSV export',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 2,
      amount: 3,
      balance: 4
    },
    skipRows: 4
  },
  {
    id: 'nationwide',
    name: 'Nationwide',
    description: 'Nationwide Building Society',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 2,
      debit: 3,
      credit: 4,
      balance: 5
    },
    skipRows: 5
  },
  {
    id: 'monzo',
    name: 'Monzo',
    description: 'Monzo bank export',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 1,
      description: 3,
      amount: 5,
      category: 11
    },
    skipRows: 1
  },
  {
    id: 'revolut',
    name: 'Revolut',
    description: 'Revolut CSV export',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 2,
      description: 4,
      amount: 5,
      balance: 8
    },
    skipRows: 1
  },
  {
    id: 'starling',
    name: 'Starling Bank',
    description: 'Starling Bank CSV',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      payee: 1,
      description: 2,
      amount: 4,
      balance: 11
    },
    skipRows: 1
  },
  {
    id: 'metro-bank',
    name: 'Metro Bank',
    description: 'Metro Bank statement',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
      balance: 4
    },
    skipRows: 1
  },
  {
    id: 'tsb',
    name: 'TSB',
    description: 'TSB bank export',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 4,
      debit: 5,
      credit: 6,
      balance: 7
    },
    skipRows: 1
  },
  {
    id: 'co-op',
    name: 'Co-operative Bank',
    description: 'Co-op Bank CSV',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 2,
      debit: 3,
      credit: 4,
      balance: 5
    },
    skipRows: 1
  },
  {
    id: 'first-direct',
    name: 'First Direct',
    description: 'First Direct (HSBC)',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 1,
      amount: 2,
      balance: 3
    },
    skipRows: 1
  },
  {
    id: 'virgin-money',
    name: 'Virgin Money',
    description: 'Virgin Money CSV',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
      balance: 4
    },
    skipRows: 1
  },
  {
    id: 'amex-uk',
    name: 'American Express UK',
    description: 'Amex UK statement',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 2,
      amount: 3
    },
    skipRows: 1
  },
  {
    id: 'tesco-bank',
    name: 'Tesco Bank',
    description: 'Tesco Bank/Credit Card',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 2,
      debit: 4,
      credit: 5,
      balance: 6
    },
    skipRows: 1
  },
  // US Banks (keeping existing)
  {
    id: 'chase',
    name: 'Chase (US)',
    description: 'Chase bank statement',
    dateFormat: 'MM/DD/YYYY',
    mapping: {
      date: 0,
      description: 2,
      amount: 3,
      balance: 4
    },
    skipRows: 1
  },
  {
    id: 'bank-of-america',
    name: 'Bank of America',
    description: 'BoA transaction history',
    dateFormat: 'MM/DD/YYYY',
    mapping: {
      date: 0,
      description: 1,
      amount: 2
    },
    skipRows: 1,
    invertAmount: true
  },
  {
    id: 'wells-fargo',
    name: 'Wells Fargo',
    description: 'Wells Fargo download',
    dateFormat: 'MM/DD/YYYY',
    mapping: {
      date: 0,
      amount: 1,
      description: 4
    },
    skipRows: 0
  },
  // Generic options
  {
    id: 'generic',
    name: 'Generic CSV',
    description: 'Standard CSV format',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: 0,
      description: 1,
      amount: 2
    },
    skipRows: 1
  },
  {
    id: 'custom',
    name: 'Custom Format',
    description: 'Configure your own',
    dateFormat: 'DD/MM/YYYY',
    mapping: {
      date: null,
      description: null,
      amount: null
    },
    skipRows: 1
  }
];

export default function CSVImportWizard({ isOpen, onClose, accountId }: CSVImportWizardProps) {
  const { accounts, addTransaction, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BankTemplate>(BANK_TEMPLATES[0]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(BANK_TEMPLATES[0].mapping);
  const [dateFormat, setDateFormat] = useState(BANK_TEMPLATES[0].dateFormat);
  const [skipRows, setSkipRows] = useState(1);
  const [selectedAccount, setSelectedAccount] = useState(accountId || '');
  const [parsedTransactions, setParsedTransactions] = useState<Partial<Transaction>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [duplicateCheck, setDuplicateCheck] = useState(true);
  const [autoCategories, setAutoCategories] = useState(true);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [finalTransactions, setFinalTransactions] = useState<Partial<Transaction>[]>([]);

  const parseCSV = (content: string): string[][] => {
    const lines = content.trim().split(/\r?\n/);
    const rows: string[][] = [];
    
    for (const line of lines) {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      row.push(current.trim());
      rows.push(row);
    }
    
    return rows;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const content = await uploadedFile.text();
    setCsvContent(content);
    const rows = parseCSV(content);
    setCsvRows(rows);
    setStep(2);
  };

  const parseDate = (dateStr: string, format: string): Date => {
    const cleanDate = dateStr.replace(/"/g, '').trim();
    const parts = cleanDate.split(/[\/\-\.]/);
    
    if (format === 'MM/DD/YYYY') {
      return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    } else if (format === 'DD/MM/YYYY') {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else if (format === 'YYYY-MM-DD') {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    
    return new Date(cleanDate);
  };

  const parseAmount = (amountStr: string): number => {
    const cleanAmount = amountStr
      .replace(/[^0-9.\-]/g, '')
      .replace(/,/g, '');
    return parseFloat(cleanAmount) || 0;
  };

  const suggestCategory = (description: string): string => {
    const desc = description.toLowerCase();
    
    // Common patterns
    if (desc.includes('grocery') || desc.includes('supermarket')) return 'Groceries';
    if (desc.includes('gas') || desc.includes('fuel') || desc.includes('petrol')) return 'Transportation';
    if (desc.includes('restaurant') || desc.includes('cafe') || desc.includes('coffee')) return 'Dining Out';
    if (desc.includes('amazon') || desc.includes('ebay')) return 'Shopping';
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('subscription')) return 'Entertainment';
    if (desc.includes('rent') || desc.includes('mortgage')) return 'Housing';
    if (desc.includes('electric') || desc.includes('gas') || desc.includes('water')) return 'Utilities';
    if (desc.includes('insurance')) return 'Insurance';
    if (desc.includes('medical') || desc.includes('doctor') || desc.includes('pharmacy')) return 'Healthcare';
    
    return 'Other';
  };

  const previewTransactions = useCallback(() => {
    const errors: string[] = [];
    const transactions: Partial<Transaction>[] = [];
    
    const dataRows = csvRows.slice(skipRows);
    
    dataRows.forEach((row, index) => {
      try {
        let amount = 0;
        
        // Handle separate debit/credit columns
        if (columnMapping.debit !== null && columnMapping.credit !== null) {
          const debit = parseAmount(row[columnMapping.debit] || '0');
          const credit = parseAmount(row[columnMapping.credit] || '0');
          amount = credit - debit;
        } else if (columnMapping.amount !== null) {
          amount = parseAmount(row[columnMapping.amount] || '0');
          if (selectedTemplate.invertAmount) {
            amount = -amount;
          }
        }
        
        const transaction: Partial<Transaction> = {
          date: columnMapping.date !== null ? parseDate(row[columnMapping.date], dateFormat) : new Date(),
          description: columnMapping.description !== null ? row[columnMapping.description] : '',
          amount: Math.abs(amount),
          type: amount >= 0 ? 'income' : 'expense',
          accountId: selectedAccount,
          category: '',
          cleared: true
        };
        
        if (autoCategories) {
          transaction.category = suggestCategory(transaction.description || '');
        }
        
        transactions.push(transaction);
      } catch (error) {
        errors.push(`Row ${index + skipRows + 1}: ${error}`);
      }
    });
    
    setParsedTransactions(transactions);
    setImportErrors(errors);
  }, [csvRows, skipRows, columnMapping, dateFormat, selectedTemplate, selectedAccount, autoCategories]);

  const handleTemplateChange = (template: BankTemplate) => {
    setSelectedTemplate(template);
    setColumnMapping(template.mapping);
    setDateFormat(template.dateFormat);
    setSkipRows(template.skipRows);
  };

  const handleImport = async () => {
    if (duplicateCheck && parsedTransactions.length > 0) {
      // Show duplicate detection modal
      setShowDuplicateModal(true);
    } else {
      // Import directly without duplicate check
      await importTransactions(parsedTransactions);
    }
  };

  const importTransactions = async (transactions: Partial<Transaction>[]) => {
    let imported = 0;
    const errors: string[] = [];
    
    for (const transaction of transactions) {
      try {
        if (transaction.date && transaction.description && transaction.amount !== undefined) {
          await addTransaction({
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type as 'income' | 'expense',
            accountId: transaction.accountId!,
            category: transaction.category || 'Other',
            cleared: true
          });
          imported++;
        }
      } catch (error) {
        errors.push(`Failed to import: ${transaction.description}`);
      }
    }
    
    if (errors.length > 0) {
      setImportErrors(errors);
    } else {
      onClose();
    }
  };

  const handleDuplicateConfirm = async (transactions: Partial<Transaction>[]) => {
    setShowDuplicateModal(false);
    await importTransactions(transactions);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CSV Import Wizard"
      className="max-w-4xl"
    >
      <div className="p-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center
                ${step >= stepNum 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }
              `}>
                {stepNum}
              </div>
              {stepNum < 4 && (
                <div className={`
                  w-full h-1 mx-2
                  ${step > stepNum 
                    ? 'bg-primary' 
                    : 'bg-gray-200 dark:bg-gray-700'
                  }
                `} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload File */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <UploadIcon className="mx-auto text-gray-400 mb-4" size={64} />
              <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select a CSV file from your bank to import transactions
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <FileTextIcon className="text-gray-400 mb-2" size={48} />
                <span className="text-primary hover:underline">
                  Click to select CSV file
                </span>
                <span className="text-sm text-gray-500 mt-1">
                  or drag and drop
                </span>
              </label>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                Supported Banks:
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-blue-800 dark:text-blue-200">
                {BANK_TEMPLATES.filter(t => t.id !== 'custom').map(template => (
                  <div key={template.id}>• {template.name}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Template & Account */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Configure Import Settings</h3>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Bank Template
              </label>
              <div className="grid grid-cols-2 gap-3">
                {BANK_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateChange(template)}
                    className={`
                      p-3 rounded-lg border text-left transition-colors
                      ${selectedTemplate.id === template.id
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                      }
                    `}
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {template.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Import to Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select an account...</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({formatCurrency(account.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Date Format
                </label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800"
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Skip Header Rows
                </label>
                <input
                  type="number"
                  value={skipRows}
                  onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300"
              >
                <ArrowLeftIcon size={20} />
                Back
              </button>
              <button
                onClick={() => {
                  previewTransactions();
                  setStep(3);
                }}
                disabled={!selectedAccount}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                         hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRightIcon size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Map Columns */}
        {step === 3 && selectedTemplate.id === 'custom' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Map CSV Columns</h3>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <h4 className="font-medium mb-2">Sample Data:</h4>
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead>
                    <tr>
                      {csvRows[0]?.map((header, index) => (
                        <th key={index} className="px-2 py-1 text-left">
                          Column {index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 3).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-2 py-1 border-t dark:border-gray-700">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { field: 'date', label: 'Date Column' },
                { field: 'description', label: 'Description Column' },
                { field: 'amount', label: 'Amount Column' },
                { field: 'category', label: 'Category Column (optional)' },
                { field: 'debit', label: 'Debit Column (optional)' },
                { field: 'credit', label: 'Credit Column (optional)' }
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <select
                    value={columnMapping[field as keyof ColumnMapping] ?? ''}
                    onChange={(e) => setColumnMapping({
                      ...columnMapping,
                      [field]: e.target.value ? parseInt(e.target.value) : null
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-800"
                  >
                    <option value="">Not mapped</option>
                    {csvRows[0]?.map((_, index) => (
                      <option key={index} value={index}>
                        Column {index + 1}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300"
              >
                <ArrowLeftIcon size={20} />
                Back
              </button>
              <button
                onClick={() => {
                  previewTransactions();
                  setStep(4);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                         hover:bg-primary-dark"
              >
                Preview Import
                <ArrowRightIcon size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview & Import */}
        {step === 4 || (step === 3 && selectedTemplate.id !== 'custom') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preview Transactions</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={duplicateCheck}
                    onChange={(e) => setDuplicateCheck(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Check for duplicates</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoCategories}
                    onChange={(e) => setAutoCategories(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Auto-categorize</span>
                </label>
              </div>
            </div>

            {importErrors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircleIcon className="text-red-600 dark:text-red-400 mt-1" size={20} />
                  <div>
                    <h4 className="font-medium text-red-900 dark:text-red-300">
                      Import Errors
                    </h4>
                    <ul className="text-sm text-red-800 dark:text-red-200 mt-1">
                      {importErrors.slice(0, 5).map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                      {importErrors.length > 5 && (
                        <li>... and {importErrors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="grid grid-cols-4 gap-4 text-sm mb-2">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Transactions:</span>
                  <span className="ml-2 font-medium">{parsedTransactions.length}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Income:</span>
                  <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                    {parsedTransactions.filter(t => t.type === 'income').length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Expenses:</span>
                  <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                    {parsedTransactions.filter(t => t.type === 'expense').length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(
                      parsedTransactions.reduce((sum, t) => 
                        sum + (t.type === 'income' ? t.amount! : -t.amount!), 0
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-center">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTransactions.slice(0, 50).map((transaction, index) => (
                    <tr key={index} className="border-t dark:border-gray-700">
                      <td className="px-3 py-2">
                        {transaction.date?.toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{transaction.description}</td>
                      <td className="px-3 py-2">
                        <select
                          value={transaction.category}
                          onChange={(e) => {
                            const updated = [...parsedTransactions];
                            updated[index].category = e.target.value;
                            setParsedTransactions(updated);
                          }}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                                   bg-white dark:bg-gray-800 text-xs"
                        >
                          <option value="">Select...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(transaction.amount || 0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`
                          px-2 py-1 rounded text-xs
                          ${transaction.type === 'income'
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                          }
                        `}>
                          {transaction.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedTransactions.length > 50 && (
                <div className="p-3 text-center text-sm text-gray-500">
                  ... and {parsedTransactions.length - 50} more transactions
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(selectedTemplate.id === 'custom' ? 3 : 2)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300"
              >
                <ArrowLeftIcon size={20} />
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={parsedTransactions.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg
                         hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SaveIcon size={20} />
                Import {parsedTransactions.length} Transactions
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate Detection Modal */}
      <DuplicateDetection
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        newTransactions={parsedTransactions}
        onConfirm={handleDuplicateConfirm}
      />
    </Modal>
  );
}