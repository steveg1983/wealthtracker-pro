// Dynamic imports for heavy libraries
let jsPDF: typeof import('jspdf').jsPDF | null = null;
const html2canvas: typeof import('html2canvas').default | null = null;
import type { Transaction, Account, Category, Investment, Budget } from '../types';
import type { ExportableData, GroupedData, ChartData, SavedReport, SavedTemplate } from '../types/export';
import Decimal from 'decimal.js';
import { logger } from './loggingService';

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

class ExportService {
  private scheduledReports: ScheduledReport[] = [];
  private templates: ExportTemplate[] = [];

  constructor() {
    this.loadData();
    this.initializeDefaultTemplates();
  }

  private loadData() {
    try {
      const savedReports = localStorage.getItem('scheduled-reports');
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

      const savedTemplates = localStorage.getItem('export-templates');
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
      logger.error('Error loading export data:', error);
    }
  }

  private saveData() {
    try {
      localStorage.setItem('scheduled-reports', JSON.stringify(this.scheduledReports));
      localStorage.setItem('export-templates', JSON.stringify(this.templates));
    } catch (error) {
      logger.error('Error saving export data:', error);
    }
  }

  private initializeDefaultTemplates() {
    if (this.templates.length === 0) {
      const now = new Date();
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
          createdAt: new Date()
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
          createdAt: new Date()
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
          createdAt: new Date()
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
      id: Date.now().toString(),
      createdAt: new Date()
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
      id: Date.now().toString(),
      nextRun,
      createdAt: new Date()
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
    const now = new Date();
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

  // Comprehensive Report Generation Methods
  async generatePDFReport(exportData: any, options: ExportOptions): Promise<void> {
    // Lazy load jsPDF
    if (!jsPDF) {
      const module = await import('jspdf');
      jsPDF = module.jsPDF;
    }
    
    const doc = new jsPDF();
    let yPosition = 20;
    
    // Title
    doc.setFontSize(20);
    doc.text(exportData.reportTitle || 'Financial Report', 20, yPosition);
    yPosition += 10;
    
    // Date range
    doc.setFontSize(10);
    doc.text(`Period: ${new Date(exportData.dateRange.start).toLocaleDateString()} - ${new Date(exportData.dateRange.end).toLocaleDateString()}`, 20, yPosition);
    yPosition += 10;
    
    // Executive Summary
    if (exportData.summary) {
      yPosition += 10;
      doc.setFontSize(14);
      doc.text('Executive Summary', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      const summaryItems = [
        `Net Worth: $${exportData.summary.netWorth.toLocaleString()}`,
        `Total Assets: $${exportData.summary.totalAssets.toLocaleString()}`,
        `Total Liabilities: $${exportData.summary.totalLiabilities.toLocaleString()}`,
        `Monthly Income: $${exportData.summary.monthlyIncome.toLocaleString()}`,
        `Monthly Expenses: $${exportData.summary.monthlyExpenses.toLocaleString()}`,
        `Cash Flow: $${exportData.summary.cashFlow.toLocaleString()}`,
        `Savings Rate: ${exportData.summary.savingsRate.toFixed(1)}%`
      ];
      
      summaryItems.forEach(item => {
        doc.text(item, 30, yPosition);
        yPosition += 6;
      });
    }
    
    // Add sections
    exportData.sections.forEach((section: any) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      yPosition += 10;
      doc.setFontSize(14);
      doc.text(section.title, 20, yPosition);
      yPosition += 8;
      
      // Add section content based on type
      if (section.id === 'budgets' && exportData.data.budgetPerformance) {
        doc.setFontSize(10);
        exportData.data.budgetPerformance.forEach((budget: any) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(`${budget.categoryIdId}: $${budget.spent.toFixed(2)} / $${budget.amount.toFixed(2)} (${budget.percentUsed.toFixed(0)}%)`, 30, yPosition);
          yPosition += 6;
        });
      }
      
      if (section.id === 'goals' && exportData.data.goalProgress) {
        doc.setFontSize(10);
        exportData.data.goalProgress.forEach((goal: any) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(`${goal.name}: ${goal.progress.toFixed(0)}% complete`, 30, yPosition);
          yPosition += 6;
        });
      }
    });
    
    // Save the PDF
    doc.save(`${exportData.reportTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`);
  }

  async generateExcelReport(exportData: any, options: ExportOptions): Promise<void> {
    // Create Excel workbook with multiple sheets
    const workbook = await this.createComprehensiveExcelWorkbook(exportData, options);
    this.downloadExcel(workbook, exportData.reportTitle);
  }
  
  private async createComprehensiveExcelWorkbook(exportData: any, options: ExportOptions): Promise<any> {
    // Dynamically import xlsx library
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    
    // Summary Sheet
    const summaryData = [
      ['Financial Report'],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Period: ${new Date(exportData.dateRange.start).toLocaleDateString()} - ${new Date(exportData.dateRange.end).toLocaleDateString()}`],
      [],
      ['EXECUTIVE SUMMARY'],
      ['Metric', 'Value'],
      ['Net Worth', exportData.summary.netWorth],
      ['Total Assets', exportData.summary.totalAssets],
      ['Total Liabilities', exportData.summary.totalLiabilities],
      ['Monthly Income', exportData.summary.monthlyIncome],
      ['Monthly Expenses', exportData.summary.monthlyExpenses],
      ['Cash Flow', exportData.summary.cashFlow],
      ['Savings Rate %', exportData.summary.savingsRate]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Budget Performance Sheet
    if (exportData.data.budgetPerformance && exportData.data.budgetPerformance.length > 0) {
      const budgetData = [
        ['BUDGET PERFORMANCE'],
        [],
        ['Category', 'Budget', 'Spent', 'Remaining', '% Used', 'Status']
      ];
      
      exportData.data.budgetPerformance.forEach((budget: any) => {
        budgetData.push([
          budget.categoryIdId,
          budget.amount,
          budget.spent,
          budget.remaining,
          budget.percentUsed,
          budget.isOverBudget ? 'OVER BUDGET' : 'On Track'
        ]);
      });
      
      const budgetSheet = XLSX.utils.aoa_to_sheet(budgetData);
      XLSX.utils.book_append_sheet(workbook, budgetSheet, 'Budgets');
    }
    
    // Goals Sheet
    if (exportData.data.goalProgress && exportData.data.goalProgress.length > 0) {
      const goalsData = [
        ['FINANCIAL GOALS'],
        [],
        ['Goal Name', 'Target Amount', 'Current Amount', 'Remaining', 'Progress %', 'Status']
      ];
      
      exportData.data.goalProgress.forEach((goal: any) => {
        goalsData.push([
          goal.name,
          goal.targetAmount,
          goal.currentAmount || 0,
          goal.remaining,
          goal.progress,
          goal.isCompleted ? 'COMPLETED' : 'In Progress'
        ]);
      });
      
      const goalsSheet = XLSX.utils.aoa_to_sheet(goalsData);
      XLSX.utils.book_append_sheet(workbook, goalsSheet, 'Goals');
    }
    
    // Transactions Sheet
    if (options.includeTransactions && exportData.data.filteredTransactions) {
      const transactionData = [
        ['TRANSACTIONS'],
        [],
        ['Date', 'Description', 'Category', 'Amount', 'Type', 'Account']
      ];
      
      exportData.data.filteredTransactions.forEach((transaction: any) => {
        transactionData.push([
          new Date(transaction.date).toLocaleDateString(),
          transaction.description,
          transaction.categoryId || 'Uncategorized',
          Math.abs(transaction.amount),
          transaction.type,
          transaction.accountId || ''
        ]);
      });
      
      const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');
    }
    
    // Category Analysis Sheet
    if (exportData.data.filteredTransactions) {
      const categoryTotals: Record<string, { count: number; total: number }> = {};
      
      exportData.data.filteredTransactions.forEach((transaction: any) => {
        const category = transaction.categoryId || 'Uncategorized';
        if (!categoryTotals[category]) {
          categoryTotals[category] = { count: 0, total: 0 };
        }
        categoryTotals[category].count++;
        categoryTotals[category].total += Math.abs(transaction.amount);
      });
      
      const categoryData = [
        ['SPENDING BY CATEGORY'],
        [],
        ['Category', 'Transaction Count', 'Total Amount', 'Average']
      ];
      
      Object.entries(categoryTotals).forEach(([category, data]) => {
        categoryData.push([
          category,
          data.count.toString(),
          data.total.toString(),
          (data.total / data.count).toString()
        ]);
      });
      
      const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
      XLSX.utils.book_append_sheet(workbook, categorySheet, 'Categories');
    }
    
    return workbook;
  }
  
  private downloadExcel(workbook: any, filename: string): void {
    import('xlsx').then(XLSX => {
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      link.click();
    });
  }

  async generateCSVReport(exportData: any, options: ExportOptions): Promise<void> {
    // Create CSV content
    let csvContent = 'Financial Report\n';
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Period: ${new Date(exportData.dateRange.start).toLocaleDateString()} - ${new Date(exportData.dateRange.end).toLocaleDateString()}\n\n`;
    
    // Summary section
    csvContent += 'SUMMARY\n';
    csvContent += 'Metric,Value\n';
    csvContent += `Net Worth,$${exportData.summary.netWorth.toLocaleString()}\n`;
    csvContent += `Total Assets,$${exportData.summary.totalAssets.toLocaleString()}\n`;
    csvContent += `Total Liabilities,$${exportData.summary.totalLiabilities.toLocaleString()}\n`;
    csvContent += `Monthly Income,$${exportData.summary.monthlyIncome.toLocaleString()}\n`;
    csvContent += `Monthly Expenses,$${exportData.summary.monthlyExpenses.toLocaleString()}\n`;
    csvContent += `Cash Flow,$${exportData.summary.cashFlow.toLocaleString()}\n`;
    csvContent += `Savings Rate,${exportData.summary.savingsRate.toFixed(1)}%\n\n`;
    
    // Budget Performance
    if (exportData.data.budgetPerformance && exportData.data.budgetPerformance.length > 0) {
      csvContent += 'BUDGET PERFORMANCE\n';
      csvContent += 'Category,Budget,Spent,Remaining,% Used\n';
      exportData.data.budgetPerformance.forEach((budget: any) => {
        csvContent += `${budget.categoryIdId},$${budget.amount.toFixed(2)},$${budget.spent.toFixed(2)},$${budget.remaining.toFixed(2)},${budget.percentUsed.toFixed(0)}%\n`;
      });
      csvContent += '\n';
    }
    
    // Goal Progress
    if (exportData.data.goalProgress && exportData.data.goalProgress.length > 0) {
      csvContent += 'GOAL PROGRESS\n';
      csvContent += 'Goal,Target,Current,Remaining,Progress\n';
      exportData.data.goalProgress.forEach((goal: any) => {
        csvContent += `${goal.name},$${goal.targetAmount},$${goal.currentAmount || 0},$${goal.remaining.toFixed(2)},${goal.progress.toFixed(0)}%\n`;
      });
      csvContent += '\n';
    }
    
    // Transactions
    if (options.includeTransactions && exportData.data.filteredTransactions) {
      csvContent += 'TRANSACTIONS\n';
      csvContent += 'Date,Description,Category,Amount,Type\n';
      exportData.data.filteredTransactions.forEach((transaction: any) => {
        csvContent += `${new Date(transaction.date).toLocaleDateString()},${transaction.description},${transaction.categoryId || 'Uncategorized'},$${Math.abs(transaction.amount)},${transaction.type}\n`;
      });
    }
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${exportData.reportTitle.replace(/[^a-z0-9]/gi, '_')}.csv`;
    link.click();
  }

  // Export Functions
  async exportToCSV(
    data: Transaction[] | Account[] | Investment[],
    options: Partial<ExportOptions> = {}
  ): Promise<string> {
    const { startDate, endDate, groupBy = 'none' } = options;

    // Filter by date if specified
    let filteredData: Transaction[] | Account[] | Investment[] = data;
    if (startDate && endDate) {
      filteredData = data.filter((item: any) => {
        const itemDate = 'date' in item ? item.date : 
                        'createdAt' in item ? item.createdAt :
                        undefined;
        if (!itemDate) return false;
        return itemDate >= startDate && itemDate <= endDate;
      }) as Transaction[] | Account[] | Investment[];
    }

    // Group data if specified
    const groupedData = this.groupData(filteredData, groupBy);

    // Convert to CSV
    if (Array.isArray(groupedData)) {
      return this.arrayToCSV(groupedData);
    } else {
      // For grouped data, create summary CSV
      const summaryRows = Object.entries(groupedData).map(([group, items]) => ({
        Group: group,
        Count: Array.isArray(items) ? items.length : 1,
        Total: this.calculateGroupTotal(items)
      }));
      return this.arrayToCSV(summaryRows as any[]);
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
    
    const doc = new jsPDF();
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
        logger.warn('Could not add logo to PDF:', error);
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
      await this.addChartsToPDF(doc, data as ChartData, yPosition);
    }

    return new Uint8Array(doc.output('arraybuffer'));
  }

  private async addAccountsSummaryToPDF(doc: any, accounts: Account[], yPosition: number): Promise<number> {
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
    doc: any, 
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

  private async addInvestmentsSummaryToPDF(doc: any, investments: Investment[], yPosition: number): Promise<number> {
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
        `${investment.symbol}: ${this.formatCurrency(currentValue.toNumber())} (${gainLoss.gte(0) ? '+' : ''}${gainLossPercent.toFixed(2)}%)`,
        20,
        yPosition
      );
      yPosition += 5;
    });

    return yPosition + 15;
  }

  private async addBudgetsSummaryToPDF(doc: any, budgets: Budget[], yPosition: number): Promise<number> {
    doc.setFontSize(16);
    doc.text('Budget Summary', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    budgets.forEach(budget => {
      const spent = new Decimal(budget.spent || 0);
      const budgeted = new Decimal(budget.budgeted || budget.amount || 0);
      const remaining = budgeted.minus(spent);
      const percentSpent = budgeted.gt(0) ? spent.div(budgeted).times(100) : new Decimal(0);

      doc.text(
        `${budget.categoryId}: ${this.formatCurrency(spent.toNumber())} / ${this.formatCurrency(budgeted.toNumber())} (${percentSpent.toFixed(1)}%)`,
        20,
        yPosition
      );
      yPosition += 5;
    });

    return yPosition + 15;
  }

  private async addChartsToPDF(doc: any, data: ChartData, yPosition: number): Promise<void> {
    // This would capture chart elements from the DOM and add them to PDF
    // For now, we'll add a placeholder
    doc.setFontSize(14);
    doc.text('Charts would be rendered here from DOM elements', 20, yPosition);
  }

  // Utility functions
  private groupData(data: ExportableData[], groupBy: string): ExportableData[] | Record<string, ExportableData[]> {
    if (groupBy === 'none') return data;

    return data.reduce((groups, item) => {
      let key: string;
      
      switch (groupBy) {
        case 'category':
          key = ('category' in item ? item.category : undefined) || 'Uncategorized';
          break;
        case 'account':
          key = ('accountId' in item ? item.accountId : 'account' in item ? (item as any).account : undefined) || 'Unknown';
          break;
        case 'month': {
          const dateValue = ('date' in item ? item.date : 'createdAt' in item ? item.createdAt : undefined) || new Date();
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
      groups[key].push(item);
      return groups;
    }, {} as Record<string, ExportableData[]>);
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

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = (row as any)[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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

      logger.info('Sending scheduled report', { name: report.name, email: report.email });
      
      // Update the report
      report.lastRun = new Date();
      report.nextRun = this.calculateNextRun(report.frequency);
      this.saveData();

      return true;
    } catch (error) {
      logger.error('Error sending scheduled report:', error);
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
      qifContent += `$${account.balance.toFixed(2)}\n`;
      qifContent += '^\n';

      // Export transactions for this account
      const accountTransactions = data.transactions.filter(t => t.accountId === account.id);
      if (accountTransactions.length > 0) {
        qifContent += `!Type:${this.mapAccountType(account.type)}\n`;

        for (const transaction of accountTransactions) {
          const date = new Date(transaction.date);
          const qifDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
          
          qifContent += `D${qifDate}\n`;
          qifContent += `T${transaction.type === 'expense' ? '-' : ''}${transaction.amount.toFixed(2)}\n`;
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

  // Export to Excel format
  async exportToExcel(
    data: {
      transactions?: Transaction[];
      accounts?: Account[];
      investments?: Investment[];
      budgets?: Budget[];
    },
    options: ExportOptions
  ): Promise<Uint8Array> {
    // For now, export as CSV with multiple sheets simulated
    // In production, would use a library like xlsx or exceljs
    let excelContent = '';
    
    // Sheet 1: Accounts
    if (data.accounts && options.includeAccounts) {
      excelContent += 'Sheet: Accounts\n';
      excelContent += 'Name,Type,Balance,Currency\n';
      data.accounts.forEach(account => {
        excelContent += `${account.name},${account.type},${account.balance},${account.currency || 'USD'}\n`;
      });
      excelContent += '\n';
    }
    
    // Sheet 2: Transactions
    if (data.transactions && options.includeTransactions) {
      const filteredTransactions = data.transactions.filter(t => 
        t.date >= options.startDate && t.date <= options.endDate
      );
      
      excelContent += 'Sheet: Transactions\n';
      excelContent += 'Date,Description,Category,Amount,Type,Account\n';
      filteredTransactions.forEach(transaction => {
        const date = new Date(transaction.date).toLocaleDateString();
        excelContent += `${date},${transaction.description},${transaction.category},${transaction.amount},${transaction.type},${transaction.accountId}\n`;
      });
      excelContent += '\n';
    }
    
    // Sheet 3: Budgets
    if (data.budgets && options.includeBudgets) {
      excelContent += 'Sheet: Budgets\n';
      excelContent += 'Category,Budgeted,Spent,Remaining,Period\n';
      data.budgets.forEach(budget => {
        const spent = budget.spent || 0;
        const budgeted = budget.budgeted || 0;
        const remaining = budgeted - spent;
        excelContent += `${budget.categoryId},${budgeted},${spent},${remaining},${budget.period}\n`;
      });
      excelContent += '\n';
    }
    
    // Sheet 4: Investments
    if (data.investments && options.includeInvestments) {
      excelContent += 'Sheet: Investments\n';
      excelContent += 'Symbol,Name,Quantity,Purchase Price,Current Value,Gain/Loss\n';
      data.investments.forEach(investment => {
        const currentValue = investment.currentValue || 0;
        const costBasis = investment.costBasis || (investment.quantity * investment.purchasePrice);
        const gainLoss = currentValue - costBasis;
        excelContent += `${investment.symbol},${investment.name},${investment.quantity},${investment.purchasePrice},${currentValue},${gainLoss}\n`;
      });
    }
    
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    return encoder.encode(excelContent);
  }

  // Enhanced export method with new formats
  async exportData(
    data: {
      transactions?: Transaction[];
      accounts?: Account[];
      investments?: Investment[];
      budgets?: Budget[];
      goals?: any[];
      metadata?: any;
    },
    options: ExportOptions
  ): Promise<void> {
    const { format } = options;
    let exportContent: string | Uint8Array;
    let filename: string;
    let mimeType: string;

    // Generate export content based on format
    switch (format) {
      case 'csv':
        const dataArray = data.transactions || data.accounts || [];
        exportContent = await this.exportToCSV(dataArray, options);
        filename = `export-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      
      case 'pdf':
        exportContent = await this.exportToPDF(data, options);
        filename = `financial-report-${new Date().toISOString().split('T')[0]}.pdf`;
        mimeType = 'application/pdf';
        break;
      
      case 'xlsx':
        exportContent = await this.exportToExcel(data, options);
        filename = `financial-data-${new Date().toISOString().split('T')[0]}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      
      case 'json':
        exportContent = JSON.stringify(data, null, 2);
        filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
        break;
      
      case 'qif':
        if (!data.transactions || !data.accounts) {
          throw new Error('QIF export requires transactions and accounts data');
        }
        exportContent = this.exportToQIF({ transactions: data.transactions, accounts: data.accounts });
        filename = `transactions-${new Date().toISOString().split('T')[0]}.qif`;
        mimeType = 'application/x-qif';
        break;
      
      case 'ofx':
        if (!data.transactions || !data.accounts) {
          throw new Error('OFX export requires transactions and accounts data');
        }
        exportContent = this.exportToOFX({ transactions: data.transactions, accounts: data.accounts });
        filename = `transactions-${new Date().toISOString().split('T')[0]}.ofx`;
        mimeType = 'application/x-ofx';
        break;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Create blob and download
    const blob = exportContent instanceof Uint8Array 
      ? new Blob([exportContent], { type: mimeType })
      : new Blob([exportContent], { type: mimeType });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Log export for analytics
    logger.info('Data exported', {
      format,
      filename,
      recordCount: data.metadata?.recordCount || {},
      dateRange: options.startDate && options.endDate ? {
        start: options.startDate.toISOString(),
        end: options.endDate.toISOString()
      } : undefined
    });
  }
}

export const exportService = new ExportService();
