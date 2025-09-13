export interface ExcelExportProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ExportOptions {
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

export interface TransactionRow {
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

export interface SummaryData {
  overview: Array<{ Metric: string; Value: number | string }>;
  categoryBreakdown: Array<{
    Category: string;
    Income: number;
    Expenses: number;
    Net: number;
    'Transaction Count': number;
  }>;
  accountSummary: Array<{
    'Account Name': string;
    Type: string;
    Balance: number;
    Currency: string;
    Institution: string;
  }>;
}

export const DEFAULT_EXPORT_OPTIONS = (currencySymbol: string): ExportOptions => ({
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