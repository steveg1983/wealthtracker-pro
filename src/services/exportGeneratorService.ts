import { format } from 'date-fns';
import { logger } from './loggingService';
import type { ExportOptions } from '../config/exportTemplates';
import type { Transaction, Account, Budget } from '../types';

// Lazy load heavy libraries
let jsPDFLib: typeof import('jspdf').jsPDF | null = null;
let autoTableLib: typeof import('jspdf-autotable').default | null = null;
let XLSXLib: typeof import('xlsx') | null = null;

export class ExportGeneratorService {
  static async generatePDF(
    options: ExportOptions,
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[],
    dateRange: { start: Date; end: Date }
  ): Promise<Blob> {
    // Lazy load libraries
    if (!jsPDFLib || !autoTableLib) {
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);
      jsPDFLib = jsPDFModule.jsPDF;
      autoTableLib = autoTableModule.default;
    }

    const pdf = new jsPDFLib({
      orientation: options.orientation,
      unit: 'mm',
      format: options.paperSize
    });

    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    // Add header
    pdf.setFontSize(20);
    pdf.setTextColor(41, 128, 185);
    pdf.text(options.customTitle || 'Financial Report', 20, 20);

    // Add date range
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(
      `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`,
      20,
      30
    );

    // Filter transactions
    const filteredTransactions = this.filterTransactions(
      transactions,
      options,
      dateRange
    );

    // Add summary
    const summary = this.calculateSummary(filteredTransactions);
    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text('Summary', 20, 45);
    
    pdf.setFontSize(10);
    pdf.text(`Total Income: £${summary.income.toFixed(2)}`, 20, 55);
    pdf.text(`Total Expenses: £${summary.expenses.toFixed(2)}`, 20, 62);
    pdf.text(`Net: £${summary.net.toFixed(2)}`, 20, 69);
    pdf.text(`Transactions: ${filteredTransactions.length}`, 20, 76);

    // Add transactions table if needed
    if (options.reportType === 'transactions' || options.reportType === 'custom') {
      this.addTransactionTable(pdf, filteredTransactions, accounts, autoTable);
    }

    // Add budget analysis if needed
    if (options.reportType === 'budget' && budgets.length > 0) {
      this.addBudgetAnalysis(pdf, filteredTransactions, budgets, autoTable);
    }

    // Add footer to all pages
    this.addFooter(pdf);

    return pdf.output('blob');
  }

  static async generateExcel(
    options: ExportOptions,
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[],
    dateRange: { start: Date; end: Date }
  ): Promise<Blob> {
    // Lazy load XLSX
    if (!XLSXLib) {
      XLSXLib = await import('xlsx');
    }

    const workbook = XLSXLib.utils.book_new();
    
    // Filter transactions
    const filteredTransactions = this.filterTransactions(
      transactions,
      options,
      dateRange
    );

    // Create summary sheet
    const summaryData = this.createSummarySheet(
      options,
      filteredTransactions,
      dateRange
    );
    const summarySheet = XLSXLib.utils.aoa_to_sheet(summaryData);
    XLSXLib.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Create transactions sheet
    if (filteredTransactions.length > 0) {
      const transactionSheet = this.createTransactionSheet(
        filteredTransactions,
        accounts
      );
      XLSXLib.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');
    }

    // Create budget sheet if needed
    if (options.reportType === 'budget' && budgets.length > 0) {
      const budgetSheet = this.createBudgetSheet(
        filteredTransactions,
        budgets
      );
      XLSXLib.utils.book_append_sheet(workbook, budgetSheet, 'Budget Analysis');
    }

    // Generate blob
    const excelBuffer = XLSXLib.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    return new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  static generateCSV(
    options: ExportOptions,
    transactions: Transaction[],
    accounts: Account[],
    dateRange: { start: Date; end: Date }
  ): string {
    const filteredTransactions = this.filterTransactions(
      transactions,
      options,
      dateRange
    );

    const headers = ['Date', 'Description', 'Category', 'Account', 'Amount', 'Type'];
    
    const rows = filteredTransactions.map(t => [
      format(new Date(t.date), 'yyyy-MM-dd'),
      `"${t.description.replace(/"/g, '""')}"`,
      t.category,
      accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
      t.amount.toString(),
      t.amount >= 0 ? 'Income' : 'Expense'
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  private static filterTransactions(
    transactions: Transaction[],
    options: ExportOptions,
    dateRange: { start: Date; end: Date }
  ): Transaction[] {
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= dateRange.start && 
             transactionDate <= dateRange.end &&
             (options.accounts.length === 0 || options.accounts.includes(t.accountId)) &&
             (options.categories.length === 0 || options.categories.includes(t.category));
    });
  }

  private static calculateSummary(transactions: Transaction[]) {
    const income = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = Math.abs(transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));
    
    return {
      income,
      expenses,
      net: income - expenses,
      count: transactions.length
    };
  }

  private static addTransactionTable(
    pdf: any,
    transactions: Transaction[],
    accounts: Account[],
    autoTable: any
  ) {
    const tableData = transactions.map(t => [
      format(new Date(t.date), 'MMM d, yyyy'),
      t.description,
      t.category,
      accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
      `£${Math.abs(t.amount).toFixed(2)}`,
      t.amount > 0 ? 'Income' : 'Expense'
    ]);

    autoTable(pdf, {
      head: [['Date', 'Description', 'Category', 'Account', 'Amount', 'Type']],
      body: tableData,
      startY: 85,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
  }

  private static addBudgetAnalysis(
    pdf: any,
    transactions: Transaction[],
    budgets: Budget[],
    autoTable: any
  ) {
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.text('Budget Analysis', 20, 20);

    const budgetData = budgets.map(b => {
      const spent = Math.abs(transactions
        .filter(t => t.category === ((b as any).categoryId || (b as any).category) && t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));
      
      const percentage = (spent / b.amount) * 100;
      
      return [
        (b as any).name || (b as any).categoryId || (b as any).category,
        `£${b.amount.toFixed(2)}`,
        `£${spent.toFixed(2)}`,
        `£${(b.amount - spent).toFixed(2)}`,
        `${percentage.toFixed(1)}%`
      ];
    });

    autoTable(pdf, {
      head: [['Category', 'Budgeted', 'Spent', 'Remaining', '% Used']],
      body: budgetData,
      startY: 30,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] }
    });
  }

  private static addFooter(pdf: any) {
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `Page ${i} of ${pageCount} | Generated by WealthTracker on ${format(new Date(), 'MMM d, yyyy')}`,
        pdf.internal.pageSize.width / 2,
        pdf.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
  }

  private static createSummarySheet(
    options: ExportOptions,
    transactions: Transaction[],
    dateRange: { start: Date; end: Date }
  ) {
    const summary = this.calculateSummary(transactions);
    
    return [
      ['WealthTracker Export Report'],
      [''],
      ['Report Type:', options.reportType],
      ['Date Range:', `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`],
      ['Generated:', format(new Date(), 'MMM d, yyyy HH:mm')],
      [''],
      ['Summary Statistics'],
      ['Total Income:', summary.income],
      ['Total Expenses:', summary.expenses],
      ['Net Amount:', summary.net],
      ['Transaction Count:', summary.count]
    ];
  }

  private static createTransactionSheet(
    transactions: Transaction[],
    accounts: Account[]
  ) {
    if (!XLSXLib) throw new Error('XLSX not loaded');
    
    const data = [
      ['Date', 'Description', 'Category', 'Account', 'Amount', 'Type'],
      ...transactions.map(t => [
        format(new Date(t.date), 'yyyy-MM-dd'),
        t.description,
        t.category,
        accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
        t.amount,
        t.amount > 0 ? 'Income' : 'Expense'
      ])
    ];
    
    return XLSXLib.utils.aoa_to_sheet(data);
  }

  private static createBudgetSheet(
    transactions: Transaction[],
    budgets: Budget[]
  ) {
    if (!XLSXLib) throw new Error('XLSX not loaded');
    
    const data = [
      ['Category', 'Budgeted', 'Spent', 'Remaining', '% Used'],
      ...budgets.map(b => {
        const spent = Math.abs(transactions
        .filter(t => t.category === ((b as any).categoryId || (b as any).category) && t.amount < 0)
          .reduce((sum, t) => sum + t.amount, 0));
        const percentage = (spent / b.amount) * 100;
        
        return [
          (b as any).name || (b as any).categoryId || (b as any).category,
          b.amount,
          spent,
          b.amount - spent,
          percentage
        ];
      })
    ];
    
    return XLSXLib.utils.aoa_to_sheet(data);
  }
}
