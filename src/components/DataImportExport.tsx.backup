import React, { useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useLocalStorage } from '../hooks/useLocalStorage';
import CSVImportWizard from './CSVImportWizard';
import OFXImportModal from './OFXImportModal';
import { 
  UploadIcon, 
  DownloadIcon, 
  FileTextIcon, 
  DatabaseIcon, 
  CheckCircleIcon,
  AlertCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  SettingsIcon,
  MagicWandIcon,
  CreditCardIcon
} from './icons';

interface ImportResult {
  success: boolean;
  message: string;
  stats?: {
    accounts: number;
    transactions: number;
    categories: number;
    budgets: number;
  };
  errors?: string[];
}

interface ExportOptions {
  format: 'csv' | 'json' | 'excel';
  includeAccounts: boolean;
  includeTransactions: boolean;
  includeCategories: boolean;
  includeBudgets: boolean;
  dateRange: {
    start: string;
    end: string;
  };
}

const BANK_TEMPLATES = [
  {
    id: 'generic',
    name: 'Generic CSV',
    description: 'Standard CSV format with date, description, amount',
    mapping: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category'
    }
  },
  {
    id: 'chase',
    name: 'Chase Bank',
    description: 'Chase bank statement format',
    mapping: {
      date: 'Transaction Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category'
    }
  },
  {
    id: 'wellsfargo',
    name: 'Wells Fargo',
    description: 'Wells Fargo CSV export format',
    mapping: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category'
    }
  },
  {
    id: 'bofa',
    name: 'Bank of America',
    description: 'Bank of America statement format',
    mapping: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category'
    }
  },
  {
    id: 'mint',
    name: 'Mint.com',
    description: 'Mint.com transaction export',
    mapping: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category',
      account: 'Account Name'
    }
  },
  {
    id: 'quicken',
    name: 'Quicken',
    description: 'Quicken QIF or CSV export',
    mapping: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category'
    }
  }
];

export default function DataImportExport() {
  const { accounts, transactions, categories, addAccount, addTransaction, addCategory, budgets } = useApp();
  
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [showCsvWizard, setShowCsvWizard] = useState(false);
  const [csvImportType, setCsvImportType] = useState<'transaction' | 'account'>('transaction');
  const [showOfxModal, setShowOfxModal] = useState(false);
  
  const [exportOptions, setExportOptions] = useLocalStorage<ExportOptions>('export-options', {
    format: 'csv',
    includeAccounts: true,
    includeTransactions: true,
    includeCategories: true,
    includeBudgets: true,
    dateRange: {
      start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    }
  });

  const handleOpenCsvWizard = (type: 'transaction' | 'account') => {
    setCsvImportType(type);
    setShowCsvWizard(true);
  };

  const handleExport = () => {
    const data = {
      accounts: exportOptions.includeAccounts ? accounts : [],
      transactions: exportOptions.includeTransactions ? transactions.filter(t => {
        const date = new Date(t.date);
        return date >= new Date(exportOptions.dateRange.start) && 
               date <= new Date(exportOptions.dateRange.end);
      }) : [],
      categories: exportOptions.includeCategories ? categories : [],
      budgets: exportOptions.includeBudgets ? budgets : []
    };

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (exportOptions.format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        filename = 'wealthtracker-export.json';
        mimeType = 'application/json';
        break;
      case 'csv': {
        // Export transactions as CSV
        const csvHeaders = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account'];
        const csvRows = data.transactions.map(t => {
          const account = accounts.find(a => a.id === t.accountId);
          const category = categories.find(c => c.id === t.categoryId);
          return [
            t.date,
            `"${t.description}"`,
            t.amount.toString(),
            t.type,
            category?.name || '',
            account?.name || ''
          ].join(',');
        });
        content = [csvHeaders.join(','), ...csvRows].join('\n');
        filename = 'wealthtracker-transactions.csv';
        mimeType = 'text/csv';
        break;
      }
      default:
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Import/Export</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Import data from other financial apps or export your data
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('import')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'import'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <UploadIcon size={16} />
          Import Data
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'export'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <DownloadIcon size={16} />
          Export Data
        </button>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Import Options */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Import Data
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Choose what type of data you want to import
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CSV Transaction Import */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 hover:border-[var(--color-primary)] transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
                    <FileTextIcon className="text-[var(--color-primary)]" size={24} />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    CSV Import
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import from bank CSV exports with smart column mapping
                </p>
                <button
                  onClick={() => handleOpenCsvWizard('transaction')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  <UploadIcon size={16} />
                  Import CSV
                </button>
              </div>

              {/* OFX Import */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 hover:border-[var(--color-primary)] transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[var(--color-tertiary)]/10 rounded-full flex items-center justify-center">
                    <CreditCardIcon className="text-[var(--color-tertiary)]" size={24} />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    OFX Import
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import OFX files with automatic account matching
                </p>
                <button
                  onClick={() => setShowOfxModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-tertiary)] text-white rounded-lg hover:bg-[var(--color-tertiary)]/90"
                >
                  <UploadIcon size={16} />
                  Import OFX
                </button>
              </div>

              {/* Account Import */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 hover:border-[var(--color-primary)] transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[var(--color-secondary)]/10 rounded-full flex items-center justify-center">
                    <DatabaseIcon className="text-[var(--color-secondary)]" size={24} />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Import Accounts
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import account information from CSV files
                </p>
                <button
                  onClick={() => handleOpenCsvWizard('account')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-secondary)] text-white rounded-lg hover:bg-[var(--color-secondary)]/90"
                >
                  <UploadIcon size={16} />
                  Import CSV
                </button>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10 dark:from-[var(--color-primary)]/20 dark:to-[var(--color-secondary)]/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <MagicWandIcon className="text-[var(--color-primary)] mt-1" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Smart Import Features
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">CSV: Intelligent Mapping</h4>
                    <p>Automatically detects and maps columns from your CSV files to the appropriate fields</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">OFX: Automatic Account Matching</h4>
                    <p>Matches OFX files to your accounts using account numbers and sort codes</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Bank Templates</h4>
                    <p>Pre-configured templates for 20+ UK banks and building societies</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Duplicate Prevention</h4>
                    <p>Uses transaction IDs and smart matching to prevent duplicate imports</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {/* Export Options */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Export Options
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Export Format
                </label>
                <select
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    format: e.target.value as 'csv' | 'json' | 'excel'
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="excel">Excel (XLSX)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data to Include
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'includeAccounts', label: 'Accounts' },
                    { key: 'includeTransactions', label: 'Transactions' },
                    { key: 'includeCategories', label: 'Categories' },
                    { key: 'includeBudgets', label: 'Budgets' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportOptions[key as keyof ExportOptions] as boolean}
                        onChange={(e) => setExportOptions({
                          ...exportOptions,
                          [key]: e.target.checked
                        })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={exportOptions.dateRange.start}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    dateRange: { ...exportOptions.dateRange, start: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={exportOptions.dateRange.end}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    dateRange: { ...exportOptions.dateRange, end: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Export Summary */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Export Summary
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {exportOptions.includeAccounts ? accounts.length : 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Accounts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {exportOptions.includeTransactions ? transactions.filter(t => {
                    const date = new Date(t.date);
                    return date >= new Date(exportOptions.dateRange.start) && 
                           date <= new Date(exportOptions.dateRange.end);
                  }).length : 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {exportOptions.includeCategories ? categories.length : 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Categories</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {exportOptions.includeBudgets ? budgets.length : 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Budgets</div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                <DownloadIcon size={16} />
                Export Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Wizard */}
      <CSVImportWizard
        isOpen={showCsvWizard}
        onClose={() => setShowCsvWizard(false)}
        type={csvImportType}
      />
      
      {/* OFX Import Modal */}
      <OFXImportModal
        isOpen={showOfxModal}
        onClose={() => setShowOfxModal(false)}
      />
    </div>
  );
}