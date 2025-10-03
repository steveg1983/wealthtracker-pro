// Type definitions for export service

import type { Transaction, Account, Investment, Budget } from './index';

export interface ExportableTransaction extends Transaction {
  accountName?: string;
  categoryName?: string;
}

export interface ExportableAccount extends Account {
  currentBalance?: number;
  transactionCount?: number;
}

export interface ExportableInvestment extends Omit<Investment, 'currentValue'> {
  currentValue?: number;
  totalReturn?: number;
}

export interface ExportableBudget extends Omit<Budget, 'spent'> {
  spent?: number;
  remaining?: number;
  percentUsed?: number;
}

export type ExportableData = ExportableTransaction | ExportableAccount | ExportableInvestment | ExportableBudget;
export type ExportedData = ExportableData; // Alias for backward compatibility

export interface GroupedData {
  category?: Record<string, ExportableData[]>;
  account?: Record<string, ExportableData[]>;
  month?: Record<string, ExportableData[]>;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string;
  }>;
}

export interface SavedReport {
  nextRun: string;
  createdAt: string;
  lastRun?: string;
  options: {
    startDate: string;
    endDate: string;
    format: string;
    includeCharts: boolean;
    includeTransactions: boolean;
    includeAccounts: boolean;
    includeInvestments: boolean;
    includeBudgets: boolean;
    groupBy?: string;
    customTitle?: string;
    logoUrl?: string;
  };
  [key: string]: unknown;
}

export interface SavedTemplate {
  createdAt: string;
  options: {
    startDate: string;
    endDate: string;
    format: string;
    includeCharts: boolean;
    includeTransactions: boolean;
    includeAccounts: boolean;
    includeInvestments: boolean;
    includeBudgets: boolean;
    groupBy?: string;
    customTitle?: string;
    logoUrl?: string;
  };
  [key: string]: unknown;
}