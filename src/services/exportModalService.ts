/**
 * Export Modal Service
 * Handles all business logic for data export operations
 */

import { logger } from './loggingService';
import type { Account, Transaction, Budget, Goal } from '../types';

export type ExportFormat = 'csv' | 'pdf' | 'xlsx' | 'json' | 'qif' | 'ofx';
export type DateRange = 'all' | 'month' | 'quarter' | 'year' | 'custom';
export type GroupBy = 'none' | 'category' | 'account' | 'month';

export interface ExportOptions {
  format: ExportFormat;
  startDate: Date;
  endDate: Date;
  includeCharts: boolean;
  includeTransactions: boolean;
  includeAccounts: boolean;
  includeBudgets: boolean;
  includeGoals: boolean;
  groupBy?: GroupBy;
  customTitle: string;
}

export interface ExportData {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  metadata: {
    exportDate: Date;
    dateRange: { start: string; end: string };
    recordCount: {
      transactions: number;
      accounts: number;
      budgets: number;
      goals: number;
    };
  };
}

export interface FormatOption {
  value: ExportFormat;
  label: string;
  icon: string;
  description: string;
}

export interface IncludeOptions {
  transactions: boolean;
  accounts: boolean;
  budgets: boolean;
  goals: boolean;
  charts: boolean;
}

class ExportModalService {
  /**
   * Get format options for export
   */
  getFormatOptions(): FormatOption[] {
    return [
      { value: 'csv', label: 'CSV', icon: 'table-cells', description: 'For Excel and spreadsheets' },
      { value: 'pdf', label: 'PDF', icon: 'document-text', description: 'Professional reports' },
      { value: 'xlsx', label: 'Excel', icon: 'document-chart-bar', description: 'Native Excel format' },
      { value: 'json', label: 'JSON', icon: 'document-text', description: 'For backups and APIs' },
      { value: 'qif', label: 'QIF', icon: 'document-arrow-down', description: 'For Quicken' },
      { value: 'ofx', label: 'OFX', icon: 'document-arrow-down', description: 'For accounting software' }
    ];
  }

  /**
   * Calculate date range based on selection
   */
  calculateDateRange(range: DateRange): { start: string; end: string } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (range) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        startDate = quarterStart;
        endDate = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = now;
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * Get initial date range
   */
  getInitialDateRange(): { start: string; end: string } {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return {
      start: date.toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Filter transactions by date range
   */
  filterTransactionsByDate(
    transactions: Transaction[],
    startDate: string,
    endDate: string,
    dateRange: DateRange
  ): Transaction[] {
    if (dateRange === 'all') {
      return transactions;
    }
    
    return transactions.filter(t => {
      const date = new Date(t.date);
      return date >= new Date(startDate) && date <= new Date(endDate);
    });
  }

  /**
   * Prepare export options
   */
  prepareExportOptions(
    selectedFormat: ExportFormat,
    startDate: string,
    endDate: string,
    includeOptions: IncludeOptions,
    groupBy: GroupBy
  ): ExportOptions {
    return {
      format: selectedFormat,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      includeCharts: includeOptions.charts && (selectedFormat === 'pdf' || selectedFormat === 'xlsx'),
      includeTransactions: includeOptions.transactions,
      includeAccounts: includeOptions.accounts,
      includeBudgets: includeOptions.budgets,
      includeGoals: includeOptions.goals,
      groupBy: groupBy === 'none' ? undefined : groupBy,
      customTitle: `Financial Report - ${new Date().toLocaleDateString()}`
    };
  }

  /**
   * Prepare export data
   */
  prepareExportData(
    filteredTransactions: Transaction[],
    accounts: Account[],
    budgets: Budget[],
    goals: Goal[],
    includeOptions: IncludeOptions,
    startDate: string,
    endDate: string
  ): ExportData {
    return {
      transactions: includeOptions.transactions ? filteredTransactions : [],
      accounts: includeOptions.accounts ? accounts : [],
      budgets: includeOptions.budgets ? budgets : [],
      goals: includeOptions.goals ? goals : [],
      metadata: {
        exportDate: new Date(),
        dateRange: { start: startDate, end: endDate },
        recordCount: {
          transactions: filteredTransactions.length,
          accounts: accounts.length,
          budgets: budgets.length,
          goals: goals.length
        }
      }
    };
  }

  /**
   * Validate export options
   */
  validateExportOptions(includeOptions: IncludeOptions): boolean {
    return includeOptions.transactions || 
           includeOptions.accounts || 
           includeOptions.budgets || 
           includeOptions.goals;
  }

  /**
   * Check if charts are supported for format
   */
  isChartsSupported(format: ExportFormat): boolean {
    return format === 'pdf' || format === 'xlsx';
  }

  /**
   * Get export summary
   */
  getExportSummary(
    format: ExportFormat,
    startDate: string,
    endDate: string,
    transactionCount: number
  ): string[] {
    const formatOption = this.getFormatOptions().find(f => f.value === format);
    return [
      `Format: ${formatOption?.label || format}`,
      `Date Range: ${startDate} to ${endDate}`,
      `Records to export: ${transactionCount} transactions`
    ];
  }

  /**
   * Get default include options
   */
  getDefaultIncludeOptions(): IncludeOptions {
    return {
      transactions: true,
      accounts: true,
      budgets: false,
      goals: false,
      charts: false
    };
  }

  /**
   * Perform export
   */
  async performExport(
    exportData: ExportData,
    exportOptions: ExportOptions
  ): Promise<void> {
    try {
      // In a real implementation, this would call the actual export service
      // For now, we'll simulate the export
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info('Export completed successfully', {
        format: exportOptions.format,
        recordCount: exportData.metadata.recordCount
      });
    } catch (error) {
      logger.error('Export failed:', error);
      throw error;
    }
  }
}

export const exportModalService = new ExportModalService();