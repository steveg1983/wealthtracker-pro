import { Account, Transaction, Category, Budget } from '../types/index';

export interface ImportResult {
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

export interface ExportOptions {
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

export interface ExportData {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

export interface BankTemplate {
  id: string;
  name: string;
  description: string;
  mapping: {
    date: string;
    description: string;
    amount: string;
    category?: string;
    account?: string;
  };
}

/**
 * Service for handling data import and export operations
 */
export class DataImportExportService {
  /**
   * Bank templates for CSV import
   */
  static readonly BANK_TEMPLATES: BankTemplate[] = [
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

  /**
   * Get default export options
   */
  static getDefaultExportOptions(): ExportOptions {
    return {
      format: 'csv',
      includeAccounts: true,
      includeTransactions: true,
      includeCategories: true,
      includeBudgets: true,
      dateRange: {
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      }
    };
  }

  /**
   * Filter transactions by date range
   */
  static filterTransactionsByDateRange(
    transactions: Transaction[],
    dateRange: { start: string; end: string }
  ): Transaction[] {
    return transactions.filter((t: Transaction) => {
      const date = new Date(t.date);
      return date >= new Date(dateRange.start) && 
             date <= new Date(dateRange.end);
    });
  }

  /**
   * Export data as CSV
   */
  static exportAsCSV(
    data: ExportData,
    accounts: Account[],
    categories: Category[]
  ): ExportResult {
    const csvHeaders = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account'];
    const csvRows = data.transactions.map((t: Transaction) => {
      const account = accounts.find((a: Account) => a.id === t.accountId);
      const category = categories.find((c: Category) => c.id === t.category);
      return [
        t.date,
        `"${t.description}"`,
        t.amount.toString(),
        t.type,
        category?.name || '',
        account?.name || ''
      ].join(',');
    });
    
    return {
      content: [csvHeaders.join(','), ...csvRows].join('\n'),
      filename: 'wealthtracker-transactions.csv',
      mimeType: 'text/csv'
    };
  }

  /**
   * Export data as JSON
   */
  static exportAsJSON(data: ExportData): ExportResult {
    return {
      content: JSON.stringify(data, null, 2),
      filename: 'wealthtracker-export.json',
      mimeType: 'application/json'
    };
  }

  /**
   * Download file to user's device
   */
  static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Count items to export based on options
   */
  static countExportItems(
    options: ExportOptions,
    accounts: Account[],
    transactions: Transaction[],
    categories: Category[],
    budgets: Budget[]
  ): {
    accounts: number;
    transactions: number;
    categories: number;
    budgets: number;
  } {
    return {
      accounts: options.includeAccounts ? accounts.length : 0,
      transactions: options.includeTransactions 
        ? this.filterTransactionsByDateRange(transactions, options.dateRange).length 
        : 0,
      categories: options.includeCategories ? categories.length : 0,
      budgets: options.includeBudgets ? budgets.length : 0
    };
  }
}

export const dataImportExportService = new DataImportExportService();