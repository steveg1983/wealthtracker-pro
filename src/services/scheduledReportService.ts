import { customReportService } from './customReportService';
import { exportService } from './exportService';
import type { CustomReport } from '../components/CustomReportBuilder';
import type { Transaction, Account, Budget, Category } from '../types';
import { createScopedLogger } from '../loggers/scopedLogger';

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type TimerId = ReturnType<typeof setInterval>;

export interface ScheduledReportServiceOptions {
  storage?: StorageAdapter | null;
  setIntervalFn?: (handler: () => void, timeout: number) => TimerId;
  clearIntervalFn?: (id: TimerId) => void;
  now?: () => Date;
  logger?: ReturnType<typeof createScopedLogger>;
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

interface ReportHistoryEntry {
  reportId: string;
  reportName: string;
  runTime: Date;
  success: boolean;
  format?: ScheduledCustomReport['deliveryFormat'];
  error?: string;
}

export class ScheduledReportService {
  private readonly STORAGE_KEY = 'money_management_scheduled_custom_reports';
  private checkInterval: TimerId | null = null;
  private storage: StorageAdapter | null;
  private readonly setIntervalFn: (handler: () => void, timeout: number) => TimerId;
  private readonly clearIntervalFn: (id: TimerId) => void;
  private readonly now: () => Date;
  private readonly logger: ReturnType<typeof createScopedLogger>;

  constructor(options: ScheduledReportServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    this.setIntervalFn =
      options.setIntervalFn ??
      ((handler: () => void, timeout: number) => setInterval(handler, timeout));
    this.clearIntervalFn = options.clearIntervalFn ?? ((id: TimerId) => clearInterval(id));
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger ?? createScopedLogger('ScheduledReportService');
  }

  // Initialize the service
  initialize(): void {
    if (this.checkInterval) return;
    // Check for due reports every minute
    this.checkInterval = this.setIntervalFn(() => {
      void this.checkAndRunDueReports();
    }, 60000); // 1 minute

    // Check immediately on initialization
    void this.checkAndRunDueReports();
  }

  // Clean up
  destroy(): void {
    if (this.checkInterval) {
      this.clearIntervalFn(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Get all scheduled reports
  getScheduledReports(): ScheduledCustomReport[] {
    if (!this.storage) return [];
    try {
      const stored = this.storage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      this.logger.error('Failed to load scheduled reports', error as Error);
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
    this.storage?.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  // Delete a scheduled report
  deleteScheduledReport(reportId: string): void {
    const reports = this.getScheduledReports().filter(r => r.id !== reportId);
    this.storage?.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  // Calculate next run time
  calculateNextRun(report: ScheduledCustomReport, fromDate?: Date): Date {
    const baseDate = fromDate ?? this.now();
    const [hours, minutes] = report.time.split(':').map(Number);
    const nextRun = new Date(baseDate);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, start from tomorrow
    if (nextRun <= baseDate) {
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
        if (nextRun <= baseDate) {
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
        if (nextRun <= baseDate) {
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
        break;
      }

    return nextRun;
  }

  // Check and run due reports
  private async checkAndRunDueReports(): Promise<void> {
    const reports = this.getScheduledReports();
    const now = this.now();
    
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
      this.logger.info?.(`[ScheduledReports] Running report: ${scheduledReport.reportName}`);
      
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
      let exportResult: string | Uint8Array | Blob | ArrayBuffer | undefined;
      
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
      
      this.logger.info?.(`[ScheduledReports] Report completed: ${scheduledReport.reportName}`);
    } catch (error) {
      this.logger.error(`[ScheduledReports] Report failed: ${scheduledReport.reportName}`, error as Error);
      
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
  private getDataFromStorage(): {
    transactions: Transaction[];
    accounts: Account[];
    budgets: Budget[];
    categories: Category[];
  } {
    const storage = this.storage;
    const getJSON = (key: string) => {
      if (!storage) return '[]';
      return storage.getItem(key) ?? '[]';
    };
    return {
      transactions: JSON.parse(getJSON('money_management_transactions')) as Transaction[],
      accounts: JSON.parse(getJSON('money_management_accounts')) as Account[],
      budgets: JSON.parse(getJSON('money_management_budgets')) as Budget[],
      categories: JSON.parse(getJSON('money_management_categories')) as Category[]
    };
  }

  // Export to PDF
  private async exportToPDF(
    reportData: Awaited<ReturnType<typeof customReportService.generateReportData>>,
    customReport: CustomReport
  ): Promise<Blob> {
    // Use exportService for PDF generation
    const data = reportData.data as { transactions?: Transaction[]; accounts?: Account[]; budgets?: Budget[] };
    const pdfData = await exportService.exportToPDF(
      {
        transactions: data.transactions || [],
        accounts: data.accounts || [],
        budgets: data.budgets || []
      },
      {
        startDate: reportData.dateRange?.startDate || new Date(),
        endDate: reportData.dateRange?.endDate || new Date(),
        format: 'pdf',
        includeCharts: true,
        includeTransactions: true,
        includeAccounts: true,
        includeInvestments: false,
        includeBudgets: true,
        customTitle: customReport.name
      }
    );

    // Convert Uint8Array to Blob
    return new Blob([pdfData], { type: 'application/pdf' });
  }

  // Export to CSV
  private async exportToCSV(
    reportData: Awaited<ReturnType<typeof customReportService.generateReportData>>,
    data: ReturnType<typeof this.getDataFromStorage>
  ): Promise<string> {
    // Use existing export service
    const csvData = await exportService.exportData(
      {
        transactions: data.transactions,
        accounts: data.accounts,
        investments: [],
        budgets: data.budgets
      },
      {
        startDate: reportData.dateRange?.startDate || new Date(),
        endDate: reportData.dateRange?.endDate || new Date(),
        format: 'csv',
        includeCharts: false,
        includeTransactions: true,
        includeAccounts: true,
        includeInvestments: false,
        includeBudgets: true
      }
    );

    // exportData returns string | Uint8Array, for CSV it's always string
    return csvData as string;
  }

  // Export to Excel
  private async exportToExcel(
    reportData: Awaited<ReturnType<typeof customReportService.generateReportData>>,
    data: ReturnType<typeof this.getDataFromStorage>
  ): Promise<ArrayBuffer> {
    // Use existing export service
    const excelData = await exportService.exportData(
      {
        transactions: data.transactions,
        accounts: data.accounts,
        investments: [],
        budgets: data.budgets
      },
      {
        startDate: reportData.dateRange?.startDate || new Date(),
        endDate: reportData.dateRange?.endDate || new Date(),
        format: 'xlsx',
        includeCharts: false,
        includeTransactions: true,
        includeAccounts: true,
        includeInvestments: false,
        includeBudgets: true
      }
    );

    // exportData returns string | Uint8Array, for Excel it's Uint8Array
    // Convert Uint8Array to ArrayBuffer
    const uint8Array = excelData as Uint8Array;
    return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
  }

  // Notify email ready (placeholder for email functionality)
  private notifyEmailReady(report: ScheduledCustomReport, attachment: Blob | Uint8Array): void {
    // In a real implementation, this would send an email
    // For now, just show a notification
    if (typeof Notification !== 'undefined') {
      void new Notification('Report Ready for Email', {
        body: `${report.reportName} has been generated and is ready to email to ${report.emailRecipients?.join(', ')}`,
        icon: '/icon-192.png',
        tag: 'scheduled-report-email'
      });
    } else {
      this.logger.info?.('[ScheduledReports] Email notification ready:', {
        report: report.reportName,
        recipients: report.emailRecipients,
        attachment
      });
    }
  }

  // Add to history
  private addToHistory(entry: ReportHistoryEntry): void {
    const historyKey = 'money_management_report_history';
    const historyJson = this.storage?.getItem(historyKey) ?? '[]';
    const history = JSON.parse(historyJson) as ReportHistoryEntry[];
    history.unshift(entry);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(100);
    }
    
    this.storage?.setItem(historyKey, JSON.stringify(history));
  }

  // Get report history
  getReportHistory(): ReportHistoryEntry[] {
    const historyKey = 'money_management_report_history';
    const historyJson = this.storage?.getItem(historyKey) ?? '[]';
    return JSON.parse(historyJson) as ReportHistoryEntry[];
  }
}

export const scheduledReportService = new ScheduledReportService();
