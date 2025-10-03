/**
 * Unified Export Service - Single source of truth for all export operations
 * Consolidates functionality from multiple export services and components
 */

import type { 
  Transaction, 
  Account, 
  Category, 
  Investment, 
  Budget, 
  Goal 
} from '../../types';
import type { 
  ExportableData, 
  GroupedData, 
  ChartData, 
  SavedReport, 
  SavedTemplate 
} from '../../types/export';
import Decimal from 'decimal.js';
import { lazyLogger as logger } from '../serviceFactory';
import { format } from 'date-fns';

// Lazy-loaded heavy dependencies
let jsPDF: typeof import('jspdf').jsPDF | null = null;
let XLSX: typeof import('xlsx') | null = null;
let autoTable: typeof import('jspdf-autotable').default | null = null;

export type ExportFormat = 'csv' | 'pdf' | 'xlsx' | 'json' | 'qif' | 'ofx';
export type ReportType = 'transactions' | 'summary' | 'budget' | 'tax' | 'investment' | 'networth' | 'custom';
export type GroupByOption = 'none' | 'category' | 'account' | 'month';

export interface ExportOptions {
  startDate: Date;
  endDate: Date;
  format: ExportFormat;
  reportType?: ReportType;
  includeCharts?: boolean;
  includeTransactions?: boolean;
  includeAccounts?: boolean;
  includeInvestments?: boolean;
  includeBudgets?: boolean;
  includeGoals?: boolean;
  includeNotes?: boolean;
  groupBy?: GroupByOption;
  customTitle?: string;
  logoUrl?: string;
  paperSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  accounts?: string[];
  categories?: string[];
}

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  filename?: string;
  error?: string;
}

export class UnifiedExportService {
  private static instance: UnifiedExportService;
  private readonly CURRENCY_SYMBOL = '£';
  private readonly DATE_FORMAT = 'yyyy-MM-dd';

  private constructor() {}

  static getInstance(): UnifiedExportService {
    if (!UnifiedExportService.instance) {
      UnifiedExportService.instance = new UnifiedExportService();
    }
    return UnifiedExportService.instance;
  }

  /**
   * Main export function that routes to appropriate format handler
   */
  async export(
    data: {
      transactions?: Transaction[];
      accounts?: Account[];
      budgets?: Budget[];
      goals?: Goal[];
      investments?: Investment[];
      categories?: Category[];
    },
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      logger.info('[UnifiedExport] Starting export', { format: options.format });
      
      // Filter data by date range if provided
      const filteredData = this.filterDataByDateRange(data, options);
      
      // Route to appropriate format handler
      switch (options.format) {
        case 'csv':
          return await this.exportToCSV(filteredData, options);
        case 'pdf':
          return await this.exportToPDF(filteredData, options);
        case 'xlsx':
          return await this.exportToExcel(filteredData, options);
        case 'json':
          return await this.exportToJSON(filteredData, options);
        case 'qif':
          return await this.exportToQIF(filteredData, options);
        case 'ofx':
          return await this.exportToOFX(filteredData, options);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      logger.error('[UnifiedExport] Export failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  /**
   * CSV Export
   */
  private async exportToCSV(
    data: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    const csvContent = this.convertToCSV(data, options);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    return {
      success: true,
      data: blob,
      filename: `export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    };
  }

  /**
   * PDF Export with lazy loading
   */
  private async exportToPDF(
    data: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Lazy load jsPDF
    if (!jsPDF) {
      const module = await import('jspdf');
      jsPDF = module.jsPDF;
    }
    if (!autoTable) {
      const module = await import('jspdf-autotable');
      autoTable = module.default;
    }

    const doc = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: options.paperSize || 'a4'
    });

    // Add title
    const title = options.customTitle || 'Financial Export';
    doc.setFontSize(20);
    doc.text(title, 20, 20);

    // Add data sections
    let yPosition = 40;

    if (options.includeAccounts && data.accounts) {
      yPosition = this.addAccountsToPDF(doc, data.accounts, yPosition);
    }

    if (options.includeTransactions && data.transactions) {
      yPosition = this.addTransactionsToPDF(doc, data.transactions, yPosition);
    }

    if (options.includeBudgets && data.budgets) {
      yPosition = this.addBudgetsToPDF(doc, data.budgets, yPosition);
    }

    const pdfBlob = doc.output('blob');
    
    return {
      success: true,
      data: pdfBlob,
      filename: `export_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`
    };
  }

  /**
   * Excel Export with lazy loading
   */
  private async exportToExcel(
    data: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Lazy load XLSX
    if (!XLSX) {
      XLSX = await import('xlsx');
    }

    const wb = XLSX.utils.book_new();

    // Add sheets for each data type
    if (options.includeAccounts && data.accounts) {
      const ws = XLSX.utils.json_to_sheet(this.prepareAccountsForExcel(data.accounts));
      XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
    }

    if (options.includeTransactions && data.transactions) {
      const ws = XLSX.utils.json_to_sheet(this.prepareTransactionsForExcel(data.transactions));
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    }

    if (options.includeBudgets && data.budgets) {
      const ws = XLSX.utils.json_to_sheet(this.prepareBudgetsForExcel(data.budgets));
      XLSX.utils.book_append_sheet(wb, ws, 'Budgets');
    }

    if (options.includeGoals && data.goals) {
      const ws = XLSX.utils.json_to_sheet(this.prepareGoalsForExcel(data.goals));
      XLSX.utils.book_append_sheet(wb, ws, 'Goals');
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    return {
      success: true,
      data: blob,
      filename: `export_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
    };
  }

  /**
   * JSON Export
   */
  private async exportToJSON(
    data: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    
    return {
      success: true,
      data: blob,
      filename: `export_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`
    };
  }

  /**
   * QIF Export (Quicken Interchange Format)
   */
  private async exportToQIF(
    data: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    let qifContent = '!Type:Bank\n';
    
    // Add accounts
    if (data.accounts) {
      for (const account of data.accounts) {
        qifContent += `!Account\nN${account.name}\nT${this.mapAccountType(account.type)}\n^\n`;
        
        // Add transactions for this account
        const accountTransactions = data.transactions?.filter(
          (t: Transaction) => t.accountId === account.id
        ) || [];
        
        for (const transaction of accountTransactions) {
          qifContent += this.formatTransactionQIF(transaction);
        }
      }
    }

    const blob = new Blob([qifContent], { type: 'text/plain' });
    
    return {
      success: true,
      data: blob,
      filename: `export_${format(new Date(), 'yyyyMMdd_HHmmss')}.qif`
    };
  }

  /**
   * OFX Export (Open Financial Exchange)
   */
  private async exportToOFX(
    data: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    const ofxContent = this.generateOFXContent(data, options);
    const blob = new Blob([ofxContent], { type: 'text/plain' });
    
    return {
      success: true,
      data: blob,
      filename: `export_${format(new Date(), 'yyyyMMdd_HHmmss')}.ofx`
    };
  }

  // Helper methods
  private filterDataByDateRange(data: any, options: ExportOptions): any {
    const filtered = { ...data };
    
    if (options.startDate && options.endDate && filtered.transactions) {
      filtered.transactions = filtered.transactions.filter((t: Transaction) => {
        const transactionDate = new Date(t.date);
        return transactionDate >= options.startDate && transactionDate <= options.endDate;
      });
    }
    
    return filtered;
  }

  private convertToCSV(data: any, options: ExportOptions): string {
    const rows: string[] = [];
    
    if (options.includeTransactions && data.transactions) {
      rows.push('Date,Description,Amount,Category,Account,Notes');
      data.transactions.forEach((t: Transaction) => {
        rows.push([
          format(new Date(t.date), this.DATE_FORMAT),
          this.escapeCSV(t.description),
          t.amount.toString(),
          this.escapeCSV(t.category || ''),
          this.escapeCSV(t.accountId || ''),
          this.escapeCSV(t.notes || '')
        ].join(','));
      });
    }
    
    return rows.join('\n');
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private addAccountsToPDF(doc: any, accounts: Account[], startY: number): number {
    if (!autoTable) return startY;
    
    doc.setFontSize(14);
    doc.text('Accounts', 20, startY);
    
    const accountData = accounts.map(a => [
      a.name,
      a.type,
      `${this.CURRENCY_SYMBOL}${a.balance.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      head: [['Name', 'Type', 'Balance']],
      body: accountData,
      startY: startY + 5
    });
    
    return doc.lastAutoTable.finalY + 10;
  }

  private addTransactionsToPDF(doc: any, transactions: Transaction[], startY: number): number {
    if (!autoTable) return startY;
    
    doc.setFontSize(14);
    doc.text('Transactions', 20, startY);
    
    const transactionData = transactions.slice(0, 50).map(t => [
      format(new Date(t.date), 'dd/MM/yyyy'),
      t.description.substring(0, 30),
      `${this.CURRENCY_SYMBOL}${t.amount.toFixed(2)}`,
      t.category || ''
    ]);
    
    autoTable(doc, {
      head: [['Date', 'Description', 'Amount', 'Category']],
      body: transactionData,
      startY: startY + 5
    });
    
    return doc.lastAutoTable.finalY + 10;
  }

  private addBudgetsToPDF(doc: any, budgets: Budget[], startY: number): number {
    if (!autoTable) return startY;
    
    doc.setFontSize(14);
    doc.text('Budgets', 20, startY);
    
    const budgetData = budgets.map(b => [
      b.name || 'Unnamed Budget',
      `${this.CURRENCY_SYMBOL}${b.amount.toFixed(2)}`,
      `${this.CURRENCY_SYMBOL}${b.spent.toFixed(2)}`,
      `${((b.spent / b.amount) * 100).toFixed(1)}%`
    ] as string[]);
    
    autoTable(doc, {
      head: [['Name', 'Budget', 'Spent', 'Usage']],
      body: budgetData,
      startY: startY + 5
    });
    
    return doc.lastAutoTable.finalY + 10;
  }

  private prepareAccountsForExcel(accounts: Account[]): any[] {
    return accounts.map(a => ({
      Name: a.name,
      Type: a.type,
      Balance: a.balance,
      Institution: a.institution || '',
      'Account Number': a.accountNumber || ''
    }));
  }

  private prepareTransactionsForExcel(transactions: Transaction[]): any[] {
    return transactions.map(t => ({
      Date: format(new Date(t.date), this.DATE_FORMAT),
      Description: t.description,
      Amount: t.amount,
      Category: t.category || '',
      Account: t.accountId || '',
      Notes: t.notes || '',
      Tags: t.tags?.join(', ') || ''
    }));
  }

  private prepareBudgetsForExcel(budgets: Budget[]): any[] {
    return budgets.map(b => ({
      Name: b.name,
      Amount: b.amount,
      Spent: b.spent,
      Remaining: b.amount - b.spent,
      'Usage %': ((b.spent / b.amount) * 100).toFixed(1)
    }));
  }

  private prepareGoalsForExcel(goals: Goal[]): any[] {
    return goals.map(g => ({
      Name: g.name,
      'Target Amount': g.targetAmount,
      'Current Amount': g.currentAmount,
      Progress: `${((g.currentAmount / g.targetAmount) * 100).toFixed(1)}%`,
      'Target Date': format(new Date(g.targetDate), this.DATE_FORMAT)
    }));
  }

  private formatTransactionQIF(transaction: Transaction): string {
    return [
      `D${format(new Date(transaction.date), 'MM/dd/yyyy')}`,
      `T${transaction.amount.toFixed(2)}`,
      `P${transaction.description}`,
      transaction.notes ? `M${transaction.notes}` : '',
      transaction.category ? `L${transaction.category}` : '',
      '^'
    ].filter(Boolean).join('\n') + '\n';
  }

  private generateOFXContent(data: any, options: ExportOptions): string {
    const now = format(new Date(), "yyyyMMddHHmmss");
    
    let ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
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
  <BANKMSGSRSV1>`;

    if (data.accounts) {
      for (const account of data.accounts) {
        const transactions = data.transactions?.filter(
          (t: Transaction) => t.accountId === account.id
        ) || [];
        
        ofx += this.generateOFXAccount(account, transactions);
      }
    }

    ofx += `
  </BANKMSGSRSV1>
</OFX>`;

    return ofx;
  }

  private generateOFXAccount(account: Account, transactions: Transaction[]): string {
    const now = format(new Date(), "yyyyMMddHHmmss");
    
    let ofxAccount = `
    <STMTTRNRS>
      <TRNUID>${crypto.randomUUID()}
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <STMTRS>
        <CURDEF>GBP
        <BANKACCTFROM>
          <BANKID>000000000
          <ACCTID>${account.accountNumber || account.id}
          <ACCTTYPE>${this.mapAccountTypeOFX(account.type)}
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${now}
          <DTEND>${now}`;

    for (const transaction of transactions) {
      ofxAccount += this.generateOFXTransaction(transaction);
    }

    ofxAccount += `
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>${account.balance.toFixed(2)}
          <DTASOF>${now}
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>`;

    return ofxAccount;
  }

  private generateOFXTransaction(transaction: Transaction): string {
    const date = format(new Date(transaction.date), "yyyyMMdd");
    const type = transaction.amount > 0 ? 'CREDIT' : 'DEBIT';
    
    return `
          <STMTTRN>
            <TRNTYPE>${type}
            <DTPOSTED>${date}
            <TRNAMT>${transaction.amount.toFixed(2)}
            <FITID>${transaction.id}
            <NAME>${this.escapeXML(transaction.description)}
            ${transaction.notes ? `<MEMO>${this.escapeXML(transaction.notes)}</MEMO>` : ''}
          </STMTTRN>`;
  }

  private mapAccountType(type: string): string {
    const mapping: Record<string, string> = {
      'checking': 'Bank',
      'savings': 'Bank',
      'credit': 'CCard',
      'investment': 'Invst',
      'loan': 'OthL',
      'mortgage': 'OthL'
    };
    return mapping[type] || 'Bank';
  }

  private mapAccountTypeOFX(type: string): string {
    const mapping: Record<string, string> = {
      'checking': 'CHECKING',
      'savings': 'SAVINGS',
      'credit': 'CREDITLINE',
      'investment': 'INVESTMENT',
      'loan': 'LOAN',
      'mortgage': 'MORTGAGE'
    };
    return mapping[type] || 'CHECKING';
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Export singleton instance
export const unifiedExportService = UnifiedExportService.getInstance();