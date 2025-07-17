import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useBudgets } from '../contexts/BudgetContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
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
  MagicWandIcon
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
  const { accounts, transactions, categories, addAccount, addTransaction, addCategory } = useApp();
  const { budgets } = useBudgets();
  
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('generic');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
      processFilePreview(file);
    }
  };

  const processFilePreview = async (file: File) => {
    if (!file) return;
    
    setIsProcessing(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        setImportResult({ success: false, message: 'File is empty' });
        setIsProcessing(false);
        return;
      }
      
      // Parse CSV
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || '';
          return obj;
        }, {} as Record<string, string>);
      });
      
      setPreviewData(rows);
      
      // Auto-detect column mapping
      const template = BANK_TEMPLATES.find(t => t.id === selectedTemplate);
      if (template) {
        const autoMapping: Record<string, string> = {};
        Object.entries(template.mapping).forEach(([key, expectedHeader]) => {
          const matchedHeader = headers.find(h => 
            h.toLowerCase().includes(expectedHeader.toLowerCase()) ||
            expectedHeader.toLowerCase().includes(h.toLowerCase())
          );
          if (matchedHeader) {
            autoMapping[key] = matchedHeader;
          }
        });
        setColumnMapping(autoMapping);
      }
      
      setShowPreview(true);
    } catch (error) {
      setImportResult({ success: false, message: 'Error reading file' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setIsProcessing(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      let imported = { accounts: 0, transactions: 0, categories: 0, budgets: 0 };
      let errors: string[] = [];
      
      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row = headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
          }, {} as Record<string, string>);
          
          // Map columns to transaction fields
          const transaction = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            date: row[columnMapping.date] || new Date().toISOString().split('T')[0],
            description: row[columnMapping.description] || 'Imported transaction',
            amount: parseFloat(row[columnMapping.amount]) || 0,
            category: row[columnMapping.category] || '',
            accountId: accounts[0]?.id || '', // Default to first account
            type: parseFloat(row[columnMapping.amount]) >= 0 ? 'income' : 'expense' as 'income' | 'expense',
            cleared: false
          };
          
          // Create category if it doesn't exist
          if (transaction.category && !categories.find(c => c.name === transaction.category)) {
            const newCategory = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: transaction.category,
              color: '#3B82F6',
              icon: 'tag'
            };
            addCategory(newCategory);
            imported.categories++;
          }
          
          // Add transaction
          addTransaction({
            ...transaction,
            amount: Math.abs(transaction.amount),
            category: categories.find(c => c.name === transaction.category)?.id || ''
          });
          imported.transactions++;
          
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      setImportResult({
        success: true,
        message: 'Import completed successfully',
        stats: imported,
        errors: errors.length > 0 ? errors : undefined
      });
      
    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed'
      });
    } finally {
      setIsProcessing(false);
      setShowPreview(false);
    }
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
      case 'csv':
        // Export transactions as CSV
        const csvHeaders = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account'];
        const csvRows = data.transactions.map(t => {
          const account = accounts.find(a => a.id === t.accountId);
          const category = categories.find(c => c.id === t.category);
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
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
          {/* Bank Template Selection */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Select Import Template
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BANK_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`p-4 text-left border rounded-lg transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {template.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upload File
            </h3>
            
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <UploadIcon className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Drag and drop a CSV file here, or click to select
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 cursor-pointer"
              >
                <FileTextIcon size={16} />
                Select CSV File
              </label>
            </div>

            {importFile && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileTextIcon className="text-gray-600 dark:text-gray-400" size={20} />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Preview and Column Mapping */}
          {showPreview && (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Preview and Column Mapping
              </h3>
              
              {/* Column Mapping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {['date', 'description', 'amount', 'category'].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                    </label>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping({
                        ...columnMapping,
                        [field]: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {previewData.length > 0 && Object.keys(previewData[0]).map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {previewData.length > 0 && Object.keys(previewData[0]).map(header => (
                        <th key={header} className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 text-gray-900 dark:text-white">
                            {value as string}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRightIcon size={16} />
                      Import Data
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 ${
              importResult.success ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {importResult.success ? (
                  <CheckCircleIcon className="text-green-600 dark:text-green-400" size={24} />
                ) : (
                  <XCircleIcon className="text-red-600 dark:text-red-400" size={24} />
                )}
                <h3 className={`text-lg font-semibold ${
                  importResult.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
                }`}>
                  {importResult.success ? 'Import Successful' : 'Import Failed'}
                </h3>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {importResult.message}
              </p>
              
              {importResult.stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {importResult.stats.transactions}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Transactions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {importResult.stats.categories}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Categories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {importResult.stats.accounts}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Accounts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {importResult.stats.budgets}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Budgets</div>
                  </div>
                </div>
              )}
              
              {importResult.errors && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircleIcon className="text-red-600 dark:text-red-400" size={16} />
                    <h4 className="font-medium text-red-900 dark:text-red-100">
                      Errors ({importResult.errors.length})
                    </h4>
                  </div>
                  <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    {importResult.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>• ... and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
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
    </div>
  );
}