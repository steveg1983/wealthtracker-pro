import { useState, useCallback } from 'react';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ExportGeneratorService } from '../services/exportGeneratorService';
import { logger } from '../services/loggingService';
import type { ExportOptions, ReportTemplate } from '../config/exportTemplates';
import type { Transaction, Account, Budget } from '../types';

export function useExportManager(
  transactions: Transaction[],
  accounts: Account[],
  budgets: Budget[]
) {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    reportType: 'transactions',
    dateRange: 'thisMonth',
    accounts: [],
    categories: [],
    includeCharts: false,
    includeNotes: false,
    groupBy: 'none',
    paperSize: 'a4',
    orientation: 'portrait'
  });

  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Get date range based on options
  const getDateRange = useCallback(() => {
    const now = new Date();
    
    switch (options.dateRange) {
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'lastMonth': {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case 'thisYear':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'lastYear': {
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
      }
      case 'custom':
        return {
          start: options.startDate ? new Date(options.startDate) : startOfMonth(now),
          end: options.endDate ? new Date(options.endDate) : endOfMonth(now)
        };
      case 'all':
      default:
        return { start: new Date(2000, 0, 1), end: now };
    }
  }, [options.dateRange, options.startDate, options.endDate]);

  // Update options
  const updateOptions = useCallback((updates: Partial<ExportOptions>) => {
    setOptions(prev => ({ ...prev, ...updates }));
  }, []);

  // Apply template
  const applyTemplate = useCallback((template: ReportTemplate) => {
    setSelectedTemplate(template.id);
    setOptions(prev => ({
      ...prev,
      reportType: template.reportType,
      ...template.defaults
    }));
  }, []);

  // Generate filename
  const generateFilename = useCallback(() => {
    const type = options.reportType.toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const extension = options.format === 'excel' ? 'xlsx' : options.format;
    return `wealthtracker-${type}-${date}.${extension}`;
  }, [options.format, options.reportType]);

  // Export data
  const exportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const dateRange = getDateRange();
      let blob: Blob | string;

      switch (options.format) {
        case 'pdf':
          blob = await ExportGeneratorService.generatePDF(
            options,
            transactions,
            accounts,
            budgets,
            dateRange
          );
          break;
          
        case 'excel':
          blob = await ExportGeneratorService.generateExcel(
            options,
            transactions,
            accounts,
            budgets,
            dateRange
          );
          break;
          
        case 'csv': {
          const csvContent = ExportGeneratorService.generateCSV(
            options,
            transactions,
            accounts,
            dateRange
          );
          blob = new Blob([csvContent], { type: 'text/csv' });
          break;
        }
          
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      // Download file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      logger.info('Export completed successfully', {
        format: options.format,
        reportType: options.reportType,
        filename: generateFilename()
      });

    } catch (error) {
      logger.error('Export failed', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [options, transactions, accounts, budgets, getDateRange, generateFilename]);

  // Toggle preview
  const togglePreview = useCallback(() => {
    setShowPreview(prev => !prev);
  }, []);

  // Get filtered transaction count
  const getFilteredTransactionCount = useCallback(() => {
    const dateRange = getDateRange();
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= dateRange.start && 
             transactionDate <= dateRange.end &&
             (options.accounts.length === 0 || options.accounts.includes(t.accountId)) &&
             (options.categories.length === 0 || options.categories.includes(t.category));
    }).length;
  }, [transactions, options, getDateRange]);

  return {
    options,
    updateOptions,
    applyTemplate,
    selectedTemplate,
    isExporting,
    exportData,
    showPreview,
    togglePreview,
    getDateRange,
    getFilteredTransactionCount
  };
}