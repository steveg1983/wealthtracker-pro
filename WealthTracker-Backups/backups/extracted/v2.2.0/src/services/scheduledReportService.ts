import { customReportService } from './customReportService';
import { exportService } from './exportService';
import type { CustomReport } from '../components/CustomReportBuilder';
import type { Transaction, Account, Budget, Category } from '../types';
import { format } from 'date-fns';
import { logger } from './loggingService';

// Type for export results
type ExportResult = Blob | string | ArrayBuffer;

// Interface for report data from customReportService
interface ReportData {
  report: CustomReport;
  dateRange: {
    startDate: Date | string;
    endDate: Date | string;
  };
  data: Record<string, unknown>;
}

// Interface for stored data
interface StoredData {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  categories: Category[];
}

// Interface for report history entry
interface ReportHistoryEntry {
  reportId: string;
  reportName: string;
  runTime: Date;
  success: boolean;
  format?: string;
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
  private checkInterval: NodeJS.Timer | null = null;

  // Initialize the service
  initialize(): void {
    // Check for due reports every minute
    this.checkInterval = setInterval(() => {
      this.checkAndRunDueReports();
    }, 60000); // 1 minute

    // Check immediately on initialization
    this.checkAndRunDueReports();
  }

  // Clean up
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
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
    const [hours, minutes] = report.time.split(':').map(Number);
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

      // Generate report data
      const reportData = await customReportService.generateReportData(customReport, data);
      
      // Export in the requested format
      let exportResult: ExportResult;
      
      switch (scheduledReport.deliveryFormat) {
        case 'pdf':
          exportResult = await this.exportToPDF(reportData, customReport);
          break;
        
        case 'csv':
          exportResult = await this.exportToCSV(reportData, data);
          break;
        
        case 'excel':
          exportResult = await this.exportToExcel(reportData, data);
          break;
        
        case 'email':
          // For now, generate PDF and show notification
          exportResult = await this.exportToPDF(reportData, customReport);
          this.notifyEmailReady(scheduledReport, exportResult);
          break;
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
  private getDataFromStorage(): StoredData {
    return {
      transactions: JSON.parse(localStorage.getItem('money_management_transactions') || '[]'),
      accounts: JSON.parse(localStorage.getItem('money_management_accounts') || '[]'),
      budgets: JSON.parse(localStorage.getItem('money_management_budgets') || '[]'),
      categories: JSON.parse(localStorage.getItem('money_management_categories') || '[]')
    };
  }

  // Export to PDF
  private async exportToPDF(reportData: ReportData, customReport: CustomReport): Promise<Blob> {
    const { generatePDFReport } = await import('../utils/pdfExport');
    
    // Format data for PDF generation
    const pdfData = {
      title: customReport.name,
      dateRange: `${format(reportData.dateRange.startDate, 'MMM d, yyyy')} - ${format(reportData.dateRange.endDate, 'MMM d, yyyy')}`,
      components: reportData.data,
      customReport
    };
    
    // Generate PDF (this would need to be enhanced to handle custom components)
    const pdfBlob = await generatePDFReport(pdfData, []);
    return pdfBlob;
  }

  // Export to CSV
  private async exportToCSV(reportData: ReportData, data: StoredData): Promise<string> {
    // Use existing export service
    const csvData = await exportService.exportData(
      {
        transactions: data.transactions,
        accounts: data.accounts,
        investments: [],
        budgets: data.budgets
      },
      {
        startDate: reportData.dateRange.startDate,
        endDate: reportData.dateRange.endDate,
        format: 'csv',
        includeTransactions: true,
        includeAccounts: true,
        includeBudgets: true
      }
    );
    
    return csvData;
  }

  // Export to Excel
  private async exportToExcel(reportData: ReportData, data: StoredData): Promise<ArrayBuffer> {
    // Use existing export service
    const excelData = await exportService.exportData(
      {
        transactions: data.transactions,
        accounts: data.accounts,
        investments: [],
        budgets: data.budgets
      },
      {
        startDate: reportData.dateRange.startDate,
        endDate: reportData.dateRange.endDate,
        format: 'xlsx',
        includeTransactions: true,
        includeAccounts: true,
        includeBudgets: true
      }
    );
    
    return excelData;
  }

  // Notify email ready (placeholder for email functionality)
  private notifyEmailReady(report: ScheduledCustomReport, attachment: ExportResult): void {
    // In a real implementation, this would send an email
    // For now, just show a notification
    const notification = new Notification('Report Ready for Email', {
      body: `${report.reportName} has been generated and is ready to email to ${report.emailRecipients?.join(', ')}`,
      icon: '/icon-192.png',
      tag: 'scheduled-report-email'
    });
  }

  // Add to history
  private addToHistory(entry: ReportHistoryEntry): void {
    const historyKey = 'money_management_report_history';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    history.unshift(entry);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(100);
    }
    
    localStorage.setItem(historyKey, JSON.stringify(history));
  }

  // Get report history
  getReportHistory(): ReportHistoryEntry[] {
    const historyKey = 'money_management_report_history';
    return JSON.parse(localStorage.getItem(historyKey) || '[]');
  }
}

export const scheduledReportService = new ScheduledReportService();
