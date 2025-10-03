import { useState, useEffect, useCallback } from 'react';
import { ExportHelpers } from '../../services/export';
import type { ExportOptions } from '../../services/export';
import type { ExportTemplate, ScheduledReport } from './types';
import { useLogger } from '../services/ServiceProvider';
import type { Transaction, Account, Investment } from '../../types';

// Mock service - replace with real implementation
const exportService = {
  getTemplates: () => [],
  getScheduledReports: () => [],
  createTemplate: (template: Partial<ExportTemplate>) => {},
  deleteTemplate: (id: string) => {},
  createScheduledReport: (report: Partial<ScheduledReport>) => {},
  updateScheduledReport: (id: string, updates: Partial<ScheduledReport>) => {},
  deleteScheduledReport: (id: string) => {}
};

/**
 * Custom hook for managing export functionality
 * Handles templates, scheduled reports, and export operations
 */
export function useExportManager(
  transactions: Transaction[],
  accounts: Account[],
  investments: Investment[]
) {
  const logger = useLogger();
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
    format: 'pdf',
    includeCharts: true,
    includeTransactions: true,
    includeAccounts: true,
    includeInvestments: true,
    includeBudgets: true,
    groupBy: 'category'
  });

  const loadData = useCallback(() => {
    setTemplates(exportService.getTemplates());
    setScheduledReports(exportService.getScheduledReports());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = {
        transactions: exportOptions.includeTransactions ? transactions : undefined,
        accounts: exportOptions.includeAccounts ? accounts : undefined,
        investments: exportOptions.includeInvestments ? investments : undefined
      };

      const dateStr = exportOptions.startDate.toISOString().split('T')[0];
      
      if (exportOptions.format === 'pdf') {
        const pdfData = await ExportHelpers.toPDF(data, 'Financial Report');
        downloadFile(pdfData, 'application/pdf', `financial-report-${dateStr}.pdf`);
      } else if (exportOptions.format === 'csv') {
        const csvData = exportOptions.includeTransactions 
          ? await ExportHelpers.toCSV(transactions)
          : await ExportHelpers.toCSV([]); // ExportHelpers.toCSV only accepts transactions
        downloadFile(csvData, 'text/csv', `export-${dateStr}.csv`);
      }
    } catch (error) {
      logger.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [exportOptions, transactions, accounts, investments]);

  const downloadFile = (data: any, mimeType: string, fileName: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUseTemplate = useCallback((template: ExportTemplate) => {
    setExportOptions({
      ...template.options,
      // Update dates to current period if using relative dates
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date()
    });
  }, []);

  const handleSaveAsTemplate = useCallback(() => {
    const name = prompt('Enter template name:');
    if (!name) return;

    const description = prompt('Enter template description (optional):') || '';
    
    exportService.createTemplate({
      name,
      description,
      options: exportOptions,
      isDefault: false
    });
    
    loadData();
  }, [exportOptions, loadData]);

  const handleDeleteTemplate = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      exportService.deleteTemplate(id);
      loadData();
    }
  }, [loadData]);

  const handleCreateScheduledReport = useCallback(() => {
    const name = prompt('Enter report name:');
    if (!name) return;

    const email = prompt('Enter email address:');
    if (!email) return;

    const frequency = prompt('Enter frequency (daily, weekly, monthly, quarterly):') as ScheduledReport['frequency'];
    if (!['daily', 'weekly', 'monthly', 'quarterly'].includes(frequency)) {
      alert('Invalid frequency');
      return;
    }

    exportService.createScheduledReport({
      name,
      email,
      frequency,
      options: exportOptions,
      isActive: true
    });

    loadData();
  }, [exportOptions, loadData]);

  const handleToggleScheduledReport = useCallback((id: string) => {
    const report = scheduledReports.find(r => r.id === id);
    if (report) {
      exportService.updateScheduledReport(id, { isActive: !report.isActive });
      loadData();
    }
  }, [scheduledReports, loadData]);

  const handleDeleteScheduledReport = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this scheduled report?')) {
      exportService.deleteScheduledReport(id);
      loadData();
    }
  }, [loadData]);

  return {
    templates,
    scheduledReports,
    isLoading,
    exportOptions,
    setExportOptions,
    handleExport,
    handleUseTemplate,
    handleSaveAsTemplate,
    handleDeleteTemplate,
    handleCreateScheduledReport,
    handleToggleScheduledReport,
    handleDeleteScheduledReport
  };
}