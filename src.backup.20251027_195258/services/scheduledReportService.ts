import { customReportService } from './customReportService';
import type { GeneratedReport } from './customReportService';
import { exportService } from './exportService';
import type { ExportOptions } from './exportService';
import type { CustomReport } from '../components/CustomReportBuilder';
import type { Transaction, Account, Budget, Category } from '../types';
import { format } from 'date-fns';
import { logger } from './loggingService';

type IntervalHandle = ReturnType<typeof globalThis.setInterval>;

interface StoredReportData {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  categories: Category[];
}

interface ReportHistoryEntry {
  reportId: string;
  reportName: string;
  runTime: Date;
  success: boolean;
  error?: string;
}

interface ReportHistoryStorageEntry {
  reportId: string;
  reportName: string;
  runTime: string;
  success: boolean;
  error?: string;
}

export interface ScheduledCustomReport {
  id: string;
  customReportId: string; // Reference to custom report
  reportName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  deliveryFormat: 'pdf' | 'csv' | 'excel' | 'email';
  emailRecipients?: string[];
  lastRun?: Date;
  nextRun: Date;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class ScheduledReportService {
  private readonly STORAGE_KEY = 'money_management_scheduled_custom_reports';
  private checkInterval: IntervalHandle | null = null;

  // Initialize the service
  initialize(): void {
    // Check for due reports every minute
    this.checkInterval = globalThis.setInterval(() => {
      this.checkAndRunDueReports();
    }, 60000); // 1 minute

    // Check immediately on initialization
    this.checkAndRunDueReports();
  }

  // Clean up
  destroy(): void {
    if (this.checkInterval) {
      globalThis.clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Get all scheduled reports
  getScheduledReports(): ScheduledCustomReport[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.error('Failed to load scheduled reports:', error);
      return [];
    }
  }

  // Save a scheduled report
  saveScheduledReport(report: ScheduledCustomReport): void {
    const reports = this.getScheduledReports();
    const index = reports.findIndex(r => r.id === report.id);
    
    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.push(report);
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  // Delete a scheduled report
  deleteScheduledReport(reportId: string): void {
    const reports = this.getScheduledReports().filter(r => r.id !== reportId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  // Calculate next run time
  calculateNextRun(report: ScheduledCustomReport, fromDate: Date = new Date()): Date {
    const timeParts = report.time.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    const nextRun = new Date(fromDate);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, start from tomorrow
    if (nextRun <= fromDate) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    switch (report.frequency) {
      case 'daily':
        // Already set correctly
        break;
      
      case 'weekly': {
        const targetDay = report.dayOfWeek || 1; // Default to Monday
        while (nextRun.getDay() !== targetDay) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      }
      
      case 'monthly': {
        const targetDate = report.dayOfMonth || 1;
        nextRun.setDate(targetDate);
        // If we've passed this month's date, go to next month
        if (nextRun <= fromDate) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
      }
      
      case 'quarterly': {
        // Find next quarter start
        const currentQuarter = Math.floor(nextRun.getMonth() / 3);
        const nextQuarter = currentQuarter + 1;
        nextRun.setMonth(nextQuarter * 3, 1);
        break;
      }
      
      case 'yearly':
        nextRun.setMonth(0, 1); // January 1st
        if (nextRun <= fromDate) {
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
        break;
    }

    return nextRun;
  }

  // Check and run due reports
  private async checkAndRunDueReports(): Promise<void> {
    const reports = this.getScheduledReports();
    const now = new Date();
    
    for (const report of reports) {
      if (report.enabled && new Date(report.nextRun) <= now) {
        await this.runScheduledReport(report);
      }
    }
  }

  // Run a scheduled report
  async runScheduledReport(
    scheduledReport: ScheduledCustomReport,
    data?: {
      transactions: Transaction[];
      accounts: Account[];
      budgets: Budget[];
      categories: Category[];
    }
  ): Promise<void> {
    try {
      logger.info('[ScheduledReports] Running report', { report: scheduledReport.reportName });
      
      // Get the custom report configuration
      const customReports = customReportService.getCustomReports();
      const customReport = customReports.find(r => r.id === scheduledReport.customReportId);
      
      if (!customReport) {
        throw new Error('Custom report not found');
      }

      // If data not provided, get from localStorage
      if (!data) {
        data = this.getDataFromStorage();
      }

      // Ensure we have data before generating report
      if (!data) {
        throw new Error('No data available for report generation');
      }

      // Generate report data
      const reportData = await customReportService.generateReportData(customReport, data);
      
      // Export in the requested format
      switch (scheduledReport.deliveryFormat) {
        case 'pdf':
          await this.exportToPDF(reportData, customReport, data);
          break;

        case 'csv':
          await this.exportToCSV(reportData, data);
          break;

        case 'excel':
          await this.exportToExcel(reportData, data);
          break;

        case 'email': {
          const attachment = await this.exportToPDF(reportData, customReport, data);
          this.notifyEmailReady(scheduledReport, attachment);
          break;
        }
      }

      // Update last run and next run times
      scheduledReport.lastRun = new Date();
      scheduledReport.nextRun = this.calculateNextRun(scheduledReport);
      this.saveScheduledReport(scheduledReport);
      
      // Save to report history
      this.addToHistory({
        reportId: scheduledReport.id,
        reportName: scheduledReport.reportName,
        runTime: new Date(),
        success: true,
        format: scheduledReport.deliveryFormat
      });
      
      logger.info('[ScheduledReports] Report completed', { report: scheduledReport.reportName });
    } catch (error) {
      logger.error(`[ScheduledReports] Report failed: ${scheduledReport.reportName}`, error);
      
      // Save failure to history
      this.addToHistory({
        reportId: scheduledReport.id,
        reportName: scheduledReport.reportName,
        runTime: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get data from localStorage
  private getDataFromStorage(): StoredReportData {
    const parseArray = <T>(key: string): T[] => {
      try {
        const value = localStorage.getItem(key);
        if (!value) return [];
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
      } catch {
        return [];
      }
    };

    return {
      transactions: parseArray<Transaction>('money_management_transactions'),
      accounts: parseArray<Account>('money_management_accounts'),
      budgets: parseArray<Budget>('money_management_budgets'),
      categories: parseArray<Category>('money_management_categories')
    };
  }

  private serializeHistoryEntry(entry: ReportHistoryEntry): ReportHistoryStorageEntry {
    return {
      reportId: entry.reportId,
      reportName: entry.reportName,
      runTime: entry.runTime.toISOString(),
      success: entry.success,
      error: entry.error
    };
  }

  // Export to PDF
  private async exportToPDF(reportData: GeneratedReport, customReport: CustomReport, data: StoredReportData): Promise<Blob> {
    const options: ExportOptions = {
      startDate: reportData.dateRange.startDate,
      endDate: reportData.dateRange.endDate,
      format: 'pdf',
      includeCharts: false,
      includeTransactions: true,
      includeAccounts: true,
      includeInvestments: false,
      includeBudgets: true,
      customTitle: customReport.name
    };

    const pdfArray = await exportService.exportToPDF(
      {
        transactions: data.transactions ?? [],
        accounts: data.accounts ?? [],
        investments: [],
        budgets: data.budgets ?? []
      },
      options
    );

    const blob = new Blob([pdfArray], { type: 'application/pdf' });
    this.triggerDownload(blob, `${customReport.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${format(reportData.dateRange.startDate, 'yyyyMMdd')}.pdf`);
    return blob;
  }

  // Export to CSV
  private async exportToCSV(reportData: GeneratedReport, data: StoredReportData): Promise<void> {
    const csvContent = await exportService.exportToCSV(
      data.transactions ?? [],
      {
        startDate: reportData.dateRange.startDate,
        endDate: reportData.dateRange.endDate,
        format: 'csv',
        includeCharts: false,
        includeTransactions: true,
        includeAccounts: true,
        includeInvestments: false,
        includeBudgets: true
      }
    );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    this.triggerDownload(blob, `report-${format(reportData.dateRange.startDate, 'yyyyMMdd')}.csv`);
  }

  // Export to Excel
  private async exportToExcel(reportData: GeneratedReport, data: StoredReportData): Promise<void> {
    const excelContent = await exportService.exportToExcel(
      {
        transactions: data.transactions ?? [],
        accounts: data.accounts ?? [],
        investments: [],
        budgets: data.budgets ?? []
      },
      {
        startDate: reportData.dateRange.startDate,
        endDate: reportData.dateRange.endDate,
        format: 'xlsx',
        includeCharts: false,
        includeTransactions: true,
        includeAccounts: true,
        includeInvestments: false,
        includeBudgets: true
      }
    );

    const blob = new Blob([excelContent], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    this.triggerDownload(blob, `report-${format(reportData.dateRange.startDate, 'yyyyMMdd')}.xlsx`);
  }

  // Notify email ready (placeholder for email functionality)
  private notifyEmailReady(report: ScheduledCustomReport, attachment: Blob): void {
    // In a real implementation, this would send an email
    // For now, just show a notification
    const notification = new Notification('Report Ready for Email', {
      body: `${report.reportName} has been generated and is ready to email to ${report.emailRecipients?.join(', ')}`,
      icon: '/icon-192.png',
      tag: 'scheduled-report-email'
    });

    notification.onclick = () => {
      window.focus();
    };

    // Attachment placeholder until email integration is implemented
    void attachment;
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Add to history
  private addToHistory(entry: ReportHistoryEntry): void {
    const historyKey = 'money_management_report_history';
    const history = this.loadHistory(historyKey);
    history.unshift(this.serializeHistoryEntry(entry));

    const trimmedHistory = history.length > 100 ? history.slice(0, 100) : history;
    localStorage.setItem(historyKey, JSON.stringify(trimmedHistory));
  }

  // Get report history
  getReportHistory(): ReportHistoryEntry[] {
    const historyKey = 'money_management_report_history';
    const stored = this.loadHistory(historyKey);

    return stored.map(entry => ({
      reportId: entry.reportId,
      reportName: entry.reportName,
      runTime: new Date(entry.runTime),
      success: entry.success,
      error: entry.error
    }));
  }

  private loadHistory(key: string): ReportHistoryStorageEntry[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ReportHistoryStorageEntry[]) : [];
    } catch {
      return [];
    }
  }
}

export const scheduledReportService = new ScheduledReportService();
