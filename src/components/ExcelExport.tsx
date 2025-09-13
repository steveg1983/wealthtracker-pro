import React, { useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { Modal } from './common/Modal';
import { 
  DownloadIcon,
  FileTextIcon,
  CheckIcon,
  SettingsIcon,
  CalendarIcon,
  TagIcon,
  WalletIcon,
  PieChartIcon,
  TrendingUpIcon,
  BarChart3Icon,
  ArrowRightLeftIcon
} from './icons';
// Dynamic import of XLSX to reduce bundle size
let XLSX: typeof import('xlsx') | null = null;
import { toDecimal } from '../utils/decimal';
import type { Transaction, Account, Budget } from '../types';
import { logger } from '../services/loggingService';

interface ExcelExportProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExportOptions {
  transactions: boolean;
  accounts: boolean;
  budgets: boolean;
  categories: boolean;
  summary: boolean;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  groupBy: 'none' | 'month' | 'category' | 'account';
  includeCharts: boolean;
  formatting: {
    currencyFormat: string;
    dateFormat: string;
    highlightNegative: boolean;
    zebra: boolean;
    autoFilter: boolean;
  };
}

export default function ExcelExport({ isOpen, onClose }: ExcelExportProps): React.JSX.Element {
  const { transactions, accounts, budgets, categories } = useApp();
  const { formatCurrency, getCurrencySymbol, displayCurrency } = useCurrencyDecimal();
  const currencySymbol = getCurrencySymbol(displayCurrency);
  const [isExporting, setIsExporting] = useState(false);
  
  const [options, setOptions] = useState<ExportOptions>({
    transactions: true,
    accounts: true,
    budgets: true,
    categories: true,
    summary: true,
    dateRange: {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date()
    },
    groupBy: 'none',
    includeCharts: false,
    formatting: {
      currencyFormat: `${currencySymbol}#,##0.00`,
      dateFormat: 'dd/mm/yyyy',
      highlightNegative: true,
      zebra: true,
      autoFilter: true
    }
  });

  const filterTransactionsByDate = (transactions: Transaction[]) => {
    if (!options.dateRange.start || !options.dateRange.end) return transactions;
    
    return transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return tDate >= options.dateRange.start! && tDate <= options.dateRange.end!;
    });
  };

  const generateSummaryData = () => {
    const filtered = filterTransactionsByDate(transactions);
    const income = filtered
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
    const expenses = filtered
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
    
    const categoryBreakdown = categories.map(cat => {
      const catTransactions = filtered.filter(t => t.category === cat.name);
      const catIncome = catTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
      const catExpenses = catTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
      
      return {
        Category: cat.name,
        Income: catIncome,
        Expenses: catExpenses,
        Net: catIncome - catExpenses,
        'Transaction Count': catTransactions.length
      };
    });

    const accountSummary = accounts.map(acc => ({
      'Account Name': acc.name,
      Type: acc.type,
      Balance: toDecimal(acc.balance).toNumber(),
      Currency: acc.currency,
      Institution: acc.institution || ''
    }));

    return {
      overview: [
        { Metric: 'Total Income', Value: income },
        { Metric: 'Total Expenses', Value: expenses },
        { Metric: 'Net Income', Value: income - expenses },
        { Metric: 'Transaction Count', Value: filtered.length },
        { Metric: 'Date Range', Value: `${options.dateRange.start?.toLocaleDateString()} - ${options.dateRange.end?.toLocaleDateString()}` }
      ],
      categoryBreakdown,
      accountSummary
    };
  };

  const createStyledWorkbook = () => {
    if (!XLSX) throw new Error('XLSX not loaded');
    const wb = XLSX.utils.book_new();
    
    // Summary Sheet
    if (options.summary) {
      const summaryData = generateSummaryData();
      const ws = XLSX.utils.json_to_sheet(summaryData.overview);
      
      // Add category breakdown below overview
      XLSX.utils.sheet_add_json(ws, summaryData.categoryBreakdown, { origin: 'A8' });
      
      // Add account summary
      XLSX.utils.sheet_add_json(ws, summaryData.accountSummary, { origin: 'A' + (8 + summaryData.categoryBreakdown.length + 2) });
      
      // Apply styles
      if (options.formatting.autoFilter) {
        ws['!autofilter'] = { ref: 'A8:E' + (8 + summaryData.categoryBreakdown.length - 1) };
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    }
    
    // Transactions Sheet
    if (options.transactions) {
      const filtered = filterTransactionsByDate(transactions);
      interface TransactionRow {
        Date: string;
        Description: string;
        Category: string;
        Type: string;
        Amount: number | string;
        Account: string;
        Tags?: string;
        Notes?: string;
        Cleared?: string;
      }
      
      let transactionData: TransactionRow[] = [];
      
      if (options.groupBy === 'month') {
        // Group by month
        const grouped = filtered.reduce((acc, t) => {
          const tDate = t.date instanceof Date ? t.date : new Date(t.date);
          const monthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
          if (!acc[monthKey]) acc[monthKey] = [];
          acc[monthKey].push(t);
          return acc;
        }, {} as Record<string, Transaction[]>);
        
        Object.entries(grouped).sort().forEach(([month, trans]) => {
          transactionData.push({ Date: month, Description: 'MONTH TOTAL', Category: '', Type: '', Amount: '', Account: '' });
          trans.forEach(t => {
            const tDate = t.date instanceof Date ? t.date : new Date(t.date);
            transactionData.push({
              Date: tDate.toLocaleDateString(),
              Description: t.description,
              Category: t.category,
              Type: t.type,
              Amount: t.type === 'expense' ? -toDecimal(t.amount).toNumber() : toDecimal(t.amount).toNumber(),
              Account: accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
              Tags: t.tags?.join(', ') || '',
              Notes: t.notes || '',
              Cleared: t.cleared ? 'Yes' : 'No'
            });
          });
          const monthTotal = trans.reduce((sum, t) => 
            sum + (t.type === 'expense' ? -toDecimal(t.amount).toNumber() : toDecimal(t.amount).toNumber()), 0
          );
          transactionData.push({ Date: '', Description: 'Subtotal', Category: '', Type: '', Amount: monthTotal, Account: '' });
          transactionData.push({ Date: '', Description: '', Category: '', Type: '', Amount: '', Account: '' }); // Empty row
        });
      } else if (options.groupBy === 'category') {
        // Group by category
        const grouped = filtered.reduce((acc, t) => {
          if (!acc[t.category]) acc[t.category] = [];
          acc[t.category].push(t);
          return acc;
        }, {} as Record<string, Transaction[]>);
        
        Object.entries(grouped).sort().forEach(([category, trans]) => {
          transactionData.push({ Date: '', Description: `CATEGORY: ${category}`, Category: '', Type: '', Amount: '', Account: '' });
          trans.forEach(t => {
            const tDate = t.date instanceof Date ? t.date : new Date(t.date);
            transactionData.push({
              Date: tDate.toLocaleDateString(),
              Description: t.description,
              Category: t.category,
              Type: t.type,
              Amount: t.type === 'expense' ? -toDecimal(t.amount).toNumber() : toDecimal(t.amount).toNumber(),
              Account: accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
              Tags: t.tags?.join(', ') || '',
              Notes: t.notes || '',
              Cleared: t.cleared ? 'Yes' : 'No'
            });
          });
          const categoryTotal = trans.reduce((sum, t) => 
            sum + (t.type === 'expense' ? -toDecimal(t.amount).toNumber() : toDecimal(t.amount).toNumber()), 0
          );
          transactionData.push({ Date: '', Description: 'Subtotal', Category: '', Type: '', Amount: categoryTotal, Account: '' });
          transactionData.push({ Date: '', Description: '', Category: '', Type: '', Amount: '', Account: '' }); // Empty row
        });
      } else {
        // No grouping
        transactionData = filtered.map(t => {
          const tDate = t.date instanceof Date ? t.date : new Date(t.date);
          return {
            Date: tDate.toLocaleDateString(),
            Description: t.description,
            Category: t.category,
            Type: t.type,
            Amount: t.type === 'expense' ? -toDecimal(t.amount).toNumber() : toDecimal(t.amount).toNumber(),
            Account: accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
            Tags: t.tags?.join(', ') || '',
            Notes: t.notes || '',
            Cleared: t.cleared ? 'Yes' : 'No'
          };
        });
      }
      
      const ws = XLSX.utils.json_to_sheet(transactionData);
      
      // Apply column widths
      ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 30 }, // Description
        { wch: 15 }, // Category
        { wch: 10 }, // Type
        { wch: 12 }, // Amount
        { wch: 20 }, // Account
        { wch: 20 }, // Tags
        { wch: 30 }, // Notes
        { wch: 8 }   // Cleared
      ];
      
      if (options.formatting.autoFilter && transactionData.length > 0) {
        ws['!autofilter'] = { ref: `A1:I${transactionData.length}` };
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    }
    
    // Accounts Sheet
    if (options.accounts) {
      const accountData = accounts.map(acc => {
        const accTransactions = transactions.filter(t => t.accountId === acc.id);
        const income = accTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
        const expenses = accTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
        
        return {
          Name: acc.name,
          Type: acc.type,
          Balance: toDecimal(acc.balance).toNumber(),
          Currency: acc.currency,
          Institution: acc.institution || '',
          'Total Income': income,
          'Total Expenses': expenses,
          'Net Change': income - expenses,
          'Transaction Count': accTransactions.length,
          'Last Updated': (acc.lastUpdated instanceof Date ? acc.lastUpdated : new Date(acc.lastUpdated)).toLocaleDateString()
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(accountData);
      ws['!cols'] = [
        { wch: 20 }, // Name
        { wch: 12 }, // Type
        { wch: 15 }, // Balance
        { wch: 10 }, // Currency
        { wch: 20 }, // Institution
        { wch: 15 }, // Total Income
        { wch: 15 }, // Total Expenses
        { wch: 15 }, // Net Change
        { wch: 15 }, // Transaction Count
        { wch: 15 }  // Last Updated
      ];
      
      if (options.formatting.autoFilter) {
        ws['!autofilter'] = { ref: `A1:J${accountData.length}` };
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
    }
    
    // Budgets Sheet
    if (options.budgets) {
      const budgetData = budgets.map(budget => {
        const spent = transactions
          .filter(t => {
            const tDate = t.date instanceof Date ? t.date : new Date(t.date);
            return t.type === 'expense' && 
              t.category === budget.categoryId &&
              tDate.getMonth() === new Date().getMonth() &&
              tDate.getFullYear() === new Date().getFullYear();
          })
          .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
        
        const remaining = toDecimal(budget.amount).toNumber() - spent;
        const percentUsed = toDecimal(budget.amount).toNumber() > 0 
          ? (spent / toDecimal(budget.amount).toNumber()) * 100 
          : 0;
        
        return {
          Category: budget.categoryId,
          'Budget Amount': toDecimal(budget.amount).toNumber(),
          Spent: spent,
          Remaining: remaining,
          '% Used': percentUsed.toFixed(1) + '%',
          Status: remaining < 0 ? 'Over Budget' : percentUsed > 80 ? 'Warning' : 'On Track'
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(budgetData);
      ws['!cols'] = [
        { wch: 20 }, // Category
        { wch: 15 }, // Budget Amount
        { wch: 15 }, // Spent
        { wch: 15 }, // Remaining
        { wch: 10 }, // % Used
        { wch: 12 }  // Status
      ];
      
      if (options.formatting.autoFilter) {
        ws['!autofilter'] = { ref: `A1:F${budgetData.length}` };
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Budgets');
    }
    
    // Categories Sheet
    if (options.categories) {
      const categoryData = categories.map(cat => {
        const catTransactions = transactions.filter(t => t.category === cat.name);
        const income = catTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
        const expenses = catTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + toDecimal(t.amount).toNumber(), 0);
        
        const budget = budgets.find(b => b.categoryId === cat.name);
        
        return {
          Name: cat.name,
          Icon: cat.icon,
          Color: cat.color,
          'Total Income': income,
          'Total Expenses': expenses,
          'Net Amount': income - expenses,
          'Transaction Count': catTransactions.length,
          'Budget Amount': budget ? toDecimal(budget.amount).toNumber() : 0,
          'Budget vs Actual': budget ? expenses - toDecimal(budget.amount).toNumber() : 0
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(categoryData);
      ws['!cols'] = [
        { wch: 20 }, // Name
        { wch: 10 }, // Icon
        { wch: 10 }, // Color
        { wch: 15 }, // Total Income
        { wch: 15 }, // Total Expenses
        { wch: 15 }, // Net Amount
        { wch: 15 }, // Transaction Count
        { wch: 15 }, // Budget Amount
        { wch: 15 }  // Budget vs Actual
      ];
      
      if (options.formatting.autoFilter) {
        ws['!autofilter'] = { ref: `A1:I${categoryData.length}` };
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Categories');
    }
    
    return wb;
  };

  const handleExport = async () => {
    try {
      // Load XLSX dynamically only when needed
      if (!XLSX) {
        setIsExporting(true);
        XLSX = await import('xlsx');
      }
      
      const wb = createStyledWorkbook();
      const filename = `wealth-tracker-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      onClose();
    } catch (error) {
      logger.error('Failed to export Excel file:', error);
      alert('Failed to export Excel file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export to Excel"
      size="lg"
    >
      <div className="p-6">
        <div className="space-y-6">
          {/* Export Options */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
              <FileTextIcon size={20} />
              Select Data to Export
            </h3>
            <div className="space-y-2">
              {[
                { key: 'transactions', label: 'Transactions', icon: <ArrowRightLeftIcon /> },
                { key: 'accounts', label: 'Accounts', icon: <WalletIcon /> },
                { key: 'budgets', label: 'Budgets', icon: <PieChartIcon /> },
                { key: 'categories', label: 'Categories', icon: <TagIcon /> },
                { key: 'summary', label: 'Summary Report', icon: <BarChart3Icon /> }
              ].map(({ key, label, icon }) => (
                <label key={key} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 
                                          dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options[key as keyof ExportOptions] as boolean}
                    onChange={(e) => setOptions({
                      ...options,
                      [key]: e.target.checked
                    })}
                    className="rounded"
                  />
                  <span className="flex items-center gap-2">
                    {icon}
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
              <CalendarIcon size={20} />
              Date Range (for transactions)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={options.dateRange.start?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setOptions({
                    ...options,
                    dateRange: {
                      ...options.dateRange,
                      start: e.target.value ? new Date(e.target.value) : null
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={options.dateRange.end?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setOptions({
                    ...options,
                    dateRange: {
                      ...options.dateRange,
                      end: e.target.value ? new Date(e.target.value) : null
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800"
                />
              </div>
            </div>
          </div>

          {/* Grouping Options */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
              <SettingsIcon size={20} />
              Transaction Grouping
            </h3>
            <select
              value={options.groupBy}
              onChange={(e) => setOptions({
                ...options,
                groupBy: e.target.value as ExportOptions['groupBy']
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800"
            >
              <option value="none">No Grouping</option>
              <option value="month">Group by Month</option>
              <option value="category">Group by Category</option>
              <option value="account">Group by Account</option>
            </select>
          </div>

          {/* Formatting Options */}
          <div>
            <h3 className="text-lg font-medium mb-3">Formatting Options</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.formatting.highlightNegative}
                  onChange={(e) => setOptions({
                    ...options,
                    formatting: {
                      ...options.formatting,
                      highlightNegative: e.target.checked
                    }
                  })}
                  className="rounded"
                />
                <span className="text-sm">Highlight negative values</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.formatting.zebra}
                  onChange={(e) => setOptions({
                    ...options,
                    formatting: {
                      ...options.formatting,
                      zebra: e.target.checked
                    }
                  })}
                  className="rounded"
                />
                <span className="text-sm">Zebra striping</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.formatting.autoFilter}
                  onChange={(e) => setOptions({
                    ...options,
                    formatting: {
                      ...options.formatting,
                      autoFilter: e.target.checked
                    }
                  })}
                  className="rounded"
                />
                <span className="text-sm">Enable auto-filters</span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                     dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!Object.values(options).slice(0, 5).some(v => v === true) || isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                     hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DownloadIcon size={20} />
            {isExporting ? 'Loading...' : 'Export to Excel'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

