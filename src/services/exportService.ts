// Dynamic imports for heavy libraries
let jsPDF: JsPDFClass | null = null;
const _html2canvas: typeof import('html2canvas').default | null = null;
import type { Transaction, Account, Investment, Budget } from '../types';
import type { ExportableData, ChartData, SavedReport, SavedTemplate } from '../types/export';
import Decimal from 'decimal.js';
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';
import { formatDecimal } from '../utils/decimal-format';
import { createScopedLogger, type ScopedLogger } from '../loggers/scopedLogger';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type JsPDFClass = typeof import('jspdf').jsPDF;
type JsPDFInstance = InstanceType<JsPDFClass>;

export interface ExportServiceOptions {
  storage?: StorageLike | null;
  logger?: ScopedLogger;
  now?: () => Date;
  idGenerator?: () => string;
}

export interface ExportOptions {
  startDate: Date;
  endDate: Date;
  format: 'csv' | 'pdf' | 'xlsx' | 'json' | 'qif' | 'ofx';
  includeCharts: boolean;
  includeTransactions: boolean;
  includeAccounts: boolean;
  includeInvestments: boolean;
  includeBudgets: boolean;
  groupBy?: 'category' | 'account' | 'month' | 'none';
  customTitle?: string;
  logoUrl?: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  email: string;
  options: ExportOptions;
  nextRun: Date;
  isActive: boolean;
  createdAt: Date;
  lastRun?: Date;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  options: ExportOptions;
  isDefault: boolean;
  createdAt: Date;
}

export class ExportService {
  private scheduledReports: ScheduledReport[] = [];
  private templates: ExportTemplate[] = [];
  private readonly storage: StorageLike | null;
  private readonly logger: ScopedLogger;
  private readonly nowProvider: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: ExportServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    this.logger = options.logger ?? createScopedLogger('ExportService');
    this.nowProvider = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? (() => Date.now().toString());
    this.loadData();
    this.initializeDefaultTemplates();
  }

  private loadData() {
    if (!this.storage) return;
    try {
      const savedReports = this.storage.getItem('scheduled-reports');
      if (savedReports) {
        this.scheduledReports = JSON.parse(savedReports).map((report: SavedReport) => ({
          ...report,
          nextRun: new Date(report.nextRun),
          createdAt: new Date(report.createdAt),
          lastRun: report.lastRun ? new Date(report.lastRun) : undefined,
          options: {
            ...report.options,
            startDate: new Date(report.options.startDate),
            endDate: new Date(report.options.endDate)
          }
        }));
      }

      const savedTemplates = this.storage.getItem('export-templates');
      if (savedTemplates) {
        this.templates = JSON.parse(savedTemplates).map((template: SavedTemplate) => ({
          ...template,
          createdAt: new Date(template.createdAt),
          options: {
            ...template.options,
            startDate: new Date(template.options.startDate),
            endDate: new Date(template.options.endDate)
          }
        }));
      }
    } catch (error) {
      this.logger.error('Error loading export data', error);
    }
  }

  private saveData() {
    if (!this.storage) return;
    try {
      this.storage.setItem('scheduled-reports', JSON.stringify(this.scheduledReports));
      this.storage.setItem('export-templates', JSON.stringify(this.templates));
    } catch (error) {
      this.logger.error('Error saving export data', error);
    }
  }

  private initializeDefaultTemplates() {
    if (this.templates.length === 0) {
      const now = this.nowProvider();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const defaultTemplates: ExportTemplate[] = [
        {
          id: 'monthly-summary',
          name: 'Monthly Summary',
          description: 'Complete monthly financial summary with charts and transactions',
          options: {
            startDate: startOfMonth,
            endDate: endOfMonth,
            format: 'pdf',
            includeCharts: true,
            includeTransactions: true,
            includeAccounts: true,
            includeInvestments: true,
            includeBudgets: true,
            groupBy: 'category'
          },
          isDefault: true,
          createdAt: this.nowProvider()
        },
        {
          id: 'transaction-report',
          name: 'Transaction Report',
          description: 'Detailed transaction listing for specified period',
          options: {
            startDate: startOfMonth,
            endDate: endOfMonth,
            format: 'csv',
            includeCharts: false,
            includeTransactions: true,
            includeAccounts: false,
            includeInvestments: false,
            includeBudgets: false,
            groupBy: 'none'
          },
          isDefault: true,
          createdAt: this.nowProvider()
        },
        {
          id: 'investment-portfolio',
          name: 'Investment Portfolio',
          description: 'Investment portfolio overview with performance charts',
          options: {
            startDate: new Date(now.getFullYear(), 0, 1), // Start of year
            endDate: now,
            format: 'pdf',
            includeCharts: true,
            includeTransactions: false,
            includeAccounts: false,
            includeInvestments: true,
            includeBudgets: false,
            groupBy: 'none'
          },
          isDefault: true,
          createdAt: this.nowProvider()
        }
      ];

      this.templates = defaultTemplates;
      this.saveData();
    }
  }

  // Export Templates
  getTemplates(): ExportTemplate[] {
    return this.templates.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  createTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt'>): ExportTemplate {
    const newTemplate: ExportTemplate = {
      ...template,
      id: this.idGenerator(),
      createdAt: this.nowProvider()
    };

    this.templates.push(newTemplate);
    this.saveData();
    return newTemplate;
  }

  updateTemplate(id: string, updates: Partial<ExportTemplate>): ExportTemplate | null {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return null;

    this.templates[index] = { ...this.templates[index], ...updates };
    this.saveData();
    return this.templates[index];
  }

  deleteTemplate(id: string): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;

    this.templates.splice(index, 1);
    this.saveData();
    return true;
  }

  // Scheduled Reports
  getScheduledReports(): ScheduledReport[] {
    return this.scheduledReports.sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
  }

  createScheduledReport(report: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>): ScheduledReport {
    const nextRun = this.calculateNextRun(report.frequency);
    const newReport: ScheduledReport = {
      ...report,
      id: this.idGenerator(),
      nextRun,
      createdAt: this.nowProvider()
    };

    this.scheduledReports.push(newReport);
    this.saveData();
    return newReport;
  }

  updateScheduledReport(id: string, updates: Partial<ScheduledReport>): ScheduledReport | null {
    const index = this.scheduledReports.findIndex(r => r.id === id);
    if (index === -1) return null;

    const updatedReport = { ...this.scheduledReports[index], ...updates };
    
    // Recalculate next run if frequency changed
    if (updates.frequency) {
      updatedReport.nextRun = this.calculateNextRun(updates.frequency);
    }

    this.scheduledReports[index] = updatedReport;
    this.saveData();
    return updatedReport;
  }

  deleteScheduledReport(id: string): boolean {
    const index = this.scheduledReports.findIndex(r => r.id === id);
    if (index === -1) return false;

    this.scheduledReports.splice(index, 1);
    this.saveData();
    return true;
  }

  private calculateNextRun(frequency: ScheduledReport['frequency']): Date {
    const now = this.nowProvider();
    const nextRun = new Date(now);

    switch (frequency) {
      case 'daily':
        nextRun.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        nextRun.setMonth(now.getMonth() + 3);
        break;
    }

    // Set to 9 AM for consistent delivery time
    nextRun.setHours(9, 0, 0, 0);
    return nextRun;
  }

  // Export Functions
  async exportToCSV(
    data: Transaction[] | Account[] | Investment[],
    options: Partial<ExportOptions> = {}
  ): Promise<string> {
    const { startDate, endDate, groupBy = 'none' } = options;

    // Filter by date if specified
    let filteredData: typeof data = data;
    if (startDate && endDate) {
      filteredData = data.filter(item => {
        const itemDate = 'date' in item ? item.date :
                        'createdAt' in item ? item.createdAt :
                        new Date();
        return itemDate! >= startDate && itemDate! <= endDate;
      }) as typeof data;
    }

    // Group data if specified
    const groupedData = this.groupData(filteredData, groupBy);

    // Convert to CSV
    if (Array.isArray(groupedData)) {
      return this.arrayToCSV(groupedData);
    } else {
      // For grouped data, create summary CSV
      const summaryRows = Object.entries(groupedData).map(([group, items]) => ({
        id: group, // Add required fields for ExportableData compatibility
        Group: group,
        Count: Array.isArray(items) ? items.length : 1,
        Total: this.calculateGroupTotal(items)
      })) as unknown as ExportableData[];
      return this.arrayToCSV(summaryRows);
    }
  }

  async exportToPDF(
    data: {
      transactions?: Transaction[];
      accounts?: Account[];
      investments?: Investment[];
      budgets?: Budget[];
    },
    options: ExportOptions
  ): Promise<Uint8Array> {
    // Load jsPDF dynamically
    if (!jsPDF) {
      const module = await import('jspdf');
      jsPDF = module.jsPDF;
    }

    const doc: JsPDFInstance = new jsPDF!();
    let yPosition = 20;

    // Add header
    doc.setFontSize(20);
    doc.text(options.customTitle || 'Financial Report', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.text(`Period: ${this.formatDate(options.startDate)} - ${this.formatDate(options.endDate)}`, 20, yPosition);
    yPosition += 20;

    // Add logo if provided
    if (options.logoUrl) {
      try {
        doc.addImage(options.logoUrl, 'PNG', 150, 10, 40, 20);
      } catch (error) {
        this.logger.warn('Could not add logo to PDF', error);
      }
    }

    // Add summary section
    if (data.accounts && options.includeAccounts) {
      yPosition = await this.addAccountsSummaryToPDF(doc, data.accounts, yPosition);
    }

    if (data.transactions && options.includeTransactions) {
      yPosition = await this.addTransactionsSummaryToPDF(doc, data.transactions, yPosition, options);
    }

    if (data.investments && options.includeInvestments) {
      yPosition = await this.addInvestmentsSummaryToPDF(doc, data.investments, yPosition);
    }

    if (data.budgets && options.includeBudgets) {
      yPosition = await this.addBudgetsSummaryToPDF(doc, data.budgets, yPosition);
    }

    // Add charts if requested
    if (options.includeCharts) {
      await this.addChartsToPDF(doc, undefined, yPosition);
    }

    const buffer = doc.output('arraybuffer');
    return new Uint8Array(buffer);
  }

  private async addAccountsSummaryToPDF(
    doc: JsPDFInstance,
    accounts: Account[],
    yPosition: number
  ): Promise<number> {
    doc.setFontSize(16);
    doc.text('Accounts Summary', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    accounts.forEach(account => {
      doc.text(`${account.name}: ${this.formatCurrency(account.balance)}`, 20, yPosition);
      yPosition += 5;
    });

    const totalBalance = accounts.reduce((sum, acc) => sum.plus(acc.balance), new Decimal(0));
    doc.setFontSize(12);
    doc.text(`Total Balance: ${this.formatCurrency(totalBalance.toNumber())}`, 20, yPosition + 5);
    
    return yPosition + 20;
  }

  private async addTransactionsSummaryToPDF(
    doc: JsPDFInstance, 
    transactions: Transaction[], 
    yPosition: number, 
    options: ExportOptions
  ): Promise<number> {
    doc.setFontSize(16);
    doc.text('Transactions Summary', 20, yPosition);
    yPosition += 10;

    // Filter transactions by date
    const filteredTransactions = transactions.filter(t => 
      t.date >= options.startDate && t.date <= options.endDate
    );

    // Group by category
    const byCategory = filteredTransactions.reduce((groups, transaction) => {
      if (!groups[transaction.category]) {
        groups[transaction.category] = [];
      }
      groups[transaction.category].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);

    doc.setFontSize(10);
    Object.entries(byCategory).forEach(([category, categoryTransactions]) => {
      const total = categoryTransactions.reduce((sum, t) => sum.plus(Math.abs(t.amount)), new Decimal(0));
      doc.text(`${category}: ${categoryTransactions.length} transactions, ${this.formatCurrency(total.toNumber())}`, 20, yPosition);
      yPosition += 5;
    });

    return yPosition + 15;
  }

  private async addInvestmentsSummaryToPDF(
    doc: JsPDFInstance,
    investments: Investment[],
    yPosition: number
  ): Promise<number> {
    doc.setFontSize(16);
    doc.text('Investments Summary', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    investments.forEach(investment => {
      const currentValue = new Decimal(investment.currentValue || 0);
      const costBasis = new Decimal(investment.costBasis || investment.quantity * investment.purchasePrice);
      const gainLoss = currentValue.minus(costBasis);
      const gainLossPercent = costBasis.gt(0) ? gainLoss.div(costBasis).times(100) : new Decimal(0);

      doc.text(
        `${investment.symbol}: ${this.formatCurrency(currentValue.toNumber())} (${gainLoss.gte(0) ? '+' : ''}${formatDecimal(gainLossPercent, 2)}%)`,
        20,
        yPosition
      );
      yPosition += 5;
    });

    return yPosition + 15;
  }

  private async addBudgetsSummaryToPDF(
    doc: JsPDFInstance,
    budgets: Budget[],
    yPosition: number
  ): Promise<number> {
    doc.setFontSize(16);
    doc.text('Budget Summary', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    budgets.forEach(budget => {
      const spent = new Decimal(budget.spent || 0);
      const budgeted = new Decimal(budget.budgeted || 0);
      const _remaining = budgeted.minus(spent);
      const percentSpent = budgeted.gt(0) ? spent.div(budgeted).times(100) : new Decimal(0);

      doc.text(
        `${budget.categoryId}: ${this.formatCurrency(spent.toNumber())} / ${this.formatCurrency(budgeted.toNumber())} (${formatDecimal(percentSpent, 1)}%)`,
        20,
        yPosition
      );
      yPosition += 5;
    });

    return yPosition + 15;
  }

  private async addChartsToPDF(
    doc: JsPDFInstance,
    _data: ChartData | undefined,
    yPosition: number
  ): Promise<void> {
    // This would capture chart elements from the DOM and add them to PDF
    // For now, we'll add a placeholder
    doc.setFontSize(14);
    doc.text('Charts would be rendered here from DOM elements', 20, yPosition);
  }

  // Utility functions
  private groupData(
    data: ExportableData[],
    groupBy: ExportOptions['groupBy'] = 'none'
  ): ExportableData[] | Record<string, ExportableData[]> {
    if (!groupBy || groupBy === 'none') return data;

    return data.reduce<Record<string, ExportableData[]>>((groups, item) => {
      let key = 'All';

      switch (groupBy) {
        case 'category':
          key = ('category' in item && item.category) ? item.category : 'Uncategorized';
          break;
        case 'account': {
          if ('accountId' in item && typeof item.accountId === 'string') {
            key = item.accountId;
          } else {
            const recordItem = item as Record<string, unknown>;
            const accountValue = recordItem.account;
            key = typeof accountValue === 'string' ? accountValue : 'Unknown';
          }
          break;
        }
        case 'month': {
          const dateValue =
            ('date' in item && item.date) ||
            ('createdAt' in item && item.createdAt) ||
            new Date();
          const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        }
        default:
          key = 'All';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key]!.push(item);
      return groups;
    }, {});
  }

  private calculateGroupTotal(items: ExportableData[]): number {
    return items.reduce((sum, item) => {
      let amount = 0;
      if ('amount' in item) amount = item.amount;
      else if ('balance' in item) amount = item.balance;
      else if ('currentValue' in item) amount = item.currentValue || 0;
      return sum + Math.abs(amount);
    }, 0);
  }

  private arrayToCSV(data: ExportableData[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const record = row as Record<string, unknown>;
          const value = record[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  private formatCurrency(amount: number): string {
    return formatCurrencyDecimal(amount, 'USD');
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Email scheduling (mock implementation)
  async sendScheduledReport(reportId: string): Promise<boolean> {
    const report = this.scheduledReports.find(r => r.id === reportId);
    if (!report || !report.isActive) return false;

    try {
      // In a real implementation, this would:
      // 1. Generate the report using the specified options
      // 2. Send email via email service (SendGrid, Mailgun, etc.)
      // 3. Update the lastRun and nextRun dates

      this.logger.info?.(`Sending scheduled report "${report.name}" to ${report.email}`);
      
      // Update the report
      report.lastRun = new Date();
      report.nextRun = this.calculateNextRun(report.frequency);
      this.saveData();

      return true;
    } catch (error) {
      this.logger.error('Error sending scheduled report', error as Error);
      return false;
    }
  }

  // Check for due reports (would be called by a background service)
  getDueReports(): ScheduledReport[] {
    const now = new Date();
    return this.scheduledReports.filter(report => 
      report.isActive && report.nextRun <= now
    );
  }

  // Export to QIF format
  exportToQIF(data: { transactions: Transaction[]; accounts: Account[] }): string {
    let qifContent = '';

    // Export accounts first
    for (const account of data.accounts) {
      qifContent += '!Account\n';
      qifContent += `N${account.name}\n`;
      qifContent += `T${this.mapAccountType(account.type)}\n`;
      qifContent += `$${formatDecimal(account.balance, 2)}\n`;
      qifContent += '^\n';

      // Export transactions for this account
      const accountTransactions = data.transactions.filter(t => t.accountId === account.id);
      if (accountTransactions.length > 0) {
        qifContent += `!Type:${this.mapAccountType(account.type)}\n`;

        for (const transaction of accountTransactions) {
          const date = new Date(transaction.date);
          const qifDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
          
          qifContent += `D${qifDate}\n`;
          qifContent += `T${transaction.type === 'expense' ? '-' : ''}${formatDecimal(transaction.amount, 2)}\n`;
          qifContent += `P${transaction.description || ''}\n`;
          qifContent += `L${transaction.category || 'Uncategorized'}\n`;
          
          if (transaction.notes) {
            qifContent += `M${transaction.notes}\n`;
          }
          
          qifContent += '^\n';
        }
      }
    }

    return qifContent;
  }

  // Export to OFX format
  exportToOFX(data: { transactions: Transaction[]; accounts: Account[] }): string {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    let ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:${now}

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${now}
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${now}
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
`;

    for (const account of data.accounts) {
      const accountTransactions = data.transactions.filter(t => t.accountId === account.id);
      
      ofxContent += `<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>${account.id}
<ACCTTYPE>${this.mapOFXAccountType(account.type)}
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${now}
<DTEND>${now}
`;

      for (const transaction of accountTransactions) {
        const date = new Date(transaction.date).toISOString().replace(/[-:]/g, '').split('.')[0];
        const amount = transaction.type === 'expense' ? `-${transaction.amount}` : `${transaction.amount}`;
        
        ofxContent += `<STMTTRN>
<TRNTYPE>${transaction.type === 'expense' ? 'DEBIT' : 'CREDIT'}
<DTPOSTED>${date}
<TRNAMT>${amount}
<FITID>${transaction.id}
<NAME>${transaction.description || ''}
<MEMO>${transaction.notes || ''}
</STMTTRN>
`;
      }

      ofxContent += `</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${account.balance}
<DTASOF>${now}
</LEDGERBAL>
</STMTRS>
`;
    }

    ofxContent += `</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    return ofxContent;
  }

  // Helper method to map account types to QIF format
  private mapAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      'current': 'Bank',
      'checking': 'Bank',
      'savings': 'Bank',
      'credit': 'CCard',
      'loan': 'Liability',
      'investment': 'Investment',
      'other': 'Bank'
    };
    return typeMap[type] || 'Bank';
  }

  // Helper method to map account types to OFX format
  private mapOFXAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      'current': 'CHECKING',
      'checking': 'CHECKING',
      'savings': 'SAVINGS',
      'credit': 'CREDITLINE',
      'loan': 'LOAN',
      'investment': 'INVESTMENT',
      'other': 'CHECKING'
    };
    return typeMap[type] || 'CHECKING';
  }

  // Enhanced export method with new formats
  async exportData(
    data: {
      transactions?: Transaction[];
      accounts?: Account[];
      investments?: Investment[];
      budgets?: Budget[];
    },
    options: ExportOptions
  ): Promise<string | Uint8Array> {
    const { format } = options;

    switch (format) {
      case 'csv': {
        // CSV can only export one type at a time, prioritize by what's available
        const csvData =
          (data.transactions as ExportableData[] | undefined) ||
          (data.accounts as ExportableData[] | undefined) ||
          (data.investments as ExportableData[] | undefined) ||
          (data.budgets as ExportableData[] | undefined) ||
          [];
        return this.exportToCSV(csvData, options);
      }
      
      case 'pdf':
        return await this.exportToPDF(data, options);
      
      case 'xlsx':
        // TODO: Implement Excel export
        return new Uint8Array();
      
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'qif':
        if (!data.transactions || !data.accounts) {
          throw new Error('QIF export requires transactions and accounts data');
        }
        return this.exportToQIF({ transactions: data.transactions, accounts: data.accounts });
      
      case 'ofx':
        if (!data.transactions || !data.accounts) {
          throw new Error('OFX export requires transactions and accounts data');
        }
        return this.exportToOFX({ transactions: data.transactions, accounts: data.accounts });
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

export const exportService = new ExportService();
