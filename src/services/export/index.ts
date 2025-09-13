/**
 * Export Service Facade - Single entry point for all export functionality
 * This replaces all duplicate export implementations across the codebase
 */

import { unifiedExportService, type ExportOptions, type ExportResult } from './UnifiedExportService';
import type { Transaction, Account, Budget, Goal, Investment } from '../../types';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { logger } from '../loggingService';

export type { ExportOptions, ExportResult } from './UnifiedExportService';
export type { ExportFormat, ReportType, GroupByOption } from './UnifiedExportService';

/**
 * Quick export presets for common use cases
 */
export const ExportPresets = {
  monthlyStatement: (month?: Date): Partial<ExportOptions> => {
    const date = month || new Date();
    return {
      startDate: startOfMonth(date),
      endDate: endOfMonth(date),
      format: 'pdf',
      reportType: 'transactions',
      includeTransactions: true,
      includeAccounts: true,
      groupBy: 'category'
    };
  },
  
  yearEndTaxReport: (year?: number): Partial<ExportOptions> => {
    const targetYear = year || new Date().getFullYear();
    return {
      startDate: new Date(targetYear, 0, 1),
      endDate: new Date(targetYear, 11, 31),
      format: 'pdf',
      reportType: 'tax',
      includeTransactions: true,
      groupBy: 'category'
    };
  },
  
  quickCSV: (): Partial<ExportOptions> => ({
    startDate: subMonths(new Date(), 3),
    endDate: new Date(),
    format: 'csv',
    includeTransactions: true
  }),
  
  fullBackup: (): Partial<ExportOptions> => ({
    startDate: new Date(2000, 0, 1),
    endDate: new Date(2099, 11, 31),
    format: 'json',
    includeTransactions: true,
    includeAccounts: true,
    includeBudgets: true,
    includeGoals: true,
    includeInvestments: true
  })
};

/**
 * Main export function - simplified interface
 */
export async function exportData(
  data: {
    transactions?: Transaction[];
    accounts?: Account[];
    budgets?: Budget[];
    goals?: Goal[];
    investments?: Investment[];
  },
  options: Partial<ExportOptions> = {}
): Promise<ExportResult> {
  // Apply defaults
  const fullOptions: ExportOptions = {
    startDate: options.startDate || subMonths(new Date(), 1),
    endDate: options.endDate || new Date(),
    format: options.format || 'csv',
    includeTransactions: options.includeTransactions ?? true,
    includeAccounts: options.includeAccounts ?? false,
    includeBudgets: options.includeBudgets ?? false,
    includeGoals: options.includeGoals ?? false,
    includeInvestments: options.includeInvestments ?? false,
    groupBy: options.groupBy || 'none',
    ...options
  };

  return unifiedExportService.export(data, fullOptions);
}

/**
 * Quick export helpers for specific formats
 */
export const ExportHelpers = {
  /**
   * Export to CSV with minimal configuration
   */
  async toCSV(transactions: Transaction[]): Promise<ExportResult> {
    return exportData({ transactions }, { format: 'csv' });
  },

  /**
   * Export to PDF with default styling
   */
  async toPDF(
    data: any,
    title?: string
  ): Promise<ExportResult> {
    return exportData(data, { 
      format: 'pdf',
      customTitle: title,
      includeCharts: true
    });
  },

  /**
   * Export to Excel with multiple sheets
   */
  async toExcel(data: any): Promise<ExportResult> {
    return exportData(data, { 
      format: 'xlsx',
      includeTransactions: true,
      includeAccounts: true,
      includeBudgets: true,
      includeGoals: true
    });
  },

  /**
   * Export for bank reconciliation (QIF format)
   */
  async forBankReconciliation(
    accounts: Account[],
    transactions: Transaction[]
  ): Promise<ExportResult> {
    return exportData(
      { accounts, transactions },
      { format: 'qif' }
    );
  },

  /**
   * Export for accounting software (OFX format)
   */
  async forAccounting(
    accounts: Account[],
    transactions: Transaction[]
  ): Promise<ExportResult> {
    return exportData(
      { accounts, transactions },
      { format: 'ofx' }
    );
  }
};

/**
 * Download helper - triggers browser download
 */
export function downloadExport(result: ExportResult): void {
  if (!result.success || !result.data || !result.filename) {
    logger.error('Export failed:', result.error);
    return;
  }

  const url = URL.createObjectURL(result.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Batch export - export multiple formats at once
 */
export async function batchExport(
  data: any,
  formats: string[]
): Promise<Record<string, ExportResult>> {
  const results: Record<string, ExportResult> = {};
  
  for (const format of formats) {
    results[format] = await exportData(data, { format: format as any });
  }
  
  return results;
}

// Re-export the unified service for advanced usage
export { unifiedExportService };