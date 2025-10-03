import { toDecimal } from '../utils/decimal';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import type { Transaction, Account, Budget, Goal } from '../types';

export interface ReportSection {
  id: string;
  title: string;
  enabled: boolean;
  description: string;
}

export interface ReportOptions {
  title: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  sections: ReportSection[];
  format: 'pdf' | 'excel' | 'csv';
  includeCharts: boolean;
  includeTransactions: boolean;
  groupBy: 'category' | 'account' | 'month' | 'none';
}

export interface ReportData {
  income: number;
  expenses: number;
  cashFlow: number;
  savingsRate: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  transactionCount: number;
  budgetPerformance: any[];
  goalProgress: any[];
  filteredTransactions: Transaction[];
}

export interface QuickRange {
  id: string;
  label: string;
  getValue: () => { start: Date; end: Date };
}

/**
 * Service for financial report generation
 */
export class ReportGeneratorService {
  /**
   * Default report sections
   */
  static readonly DEFAULT_SECTIONS: ReportSection[] = [
    { id: 'summary', title: 'Executive Summary', enabled: true, description: 'Overview of financial position' },
    { id: 'netWorth', title: 'Net Worth Analysis', enabled: true, description: 'Assets, liabilities, and trends' },
    { id: 'cashFlow', title: 'Cash Flow Statement', enabled: true, description: 'Income and expenses breakdown' },
    { id: 'budgets', title: 'Budget Performance', enabled: true, description: 'Budget vs actual spending' },
    { id: 'investments', title: 'Investment Portfolio', enabled: true, description: 'Investment performance and allocation' },
    { id: 'goals', title: 'Financial Goals Progress', enabled: true, description: 'Goal tracking and projections' },
    { id: 'transactions', title: 'Transaction Details', enabled: false, description: 'Detailed transaction list' },
    { id: 'trends', title: 'Spending Trends', enabled: true, description: 'Category-wise spending analysis' },
    { id: 'taxes', title: 'Tax Summary', enabled: false, description: 'Tax-related transactions and deductions' },
    { id: 'recommendations', title: 'Financial Recommendations', enabled: true, description: 'AI-powered insights and suggestions' }
  ];

  /**
   * Quick date range options
   */
  static readonly QUICK_RANGES: QuickRange[] = [
    { 
      id: 'thisMonth', 
      label: 'This Month', 
      getValue: () => ({ 
        start: startOfMonth(new Date()), 
        end: endOfMonth(new Date()) 
      }) 
    },
    { 
      id: 'lastMonth', 
      label: 'Last Month', 
      getValue: () => ({ 
        start: startOfMonth(subMonths(new Date(), 1)), 
        end: endOfMonth(subMonths(new Date(), 1)) 
      }) 
    },
    { 
      id: 'last3Months', 
      label: 'Last 3 Months', 
      getValue: () => ({ 
        start: subMonths(new Date(), 3), 
        end: new Date() 
      }) 
    },
    { 
      id: 'thisYear', 
      label: 'This Year', 
      getValue: () => ({ 
        start: startOfYear(new Date()), 
        end: endOfYear(new Date()) 
      }) 
    },
    { 
      id: 'lastYear', 
      label: 'Last Year', 
      getValue: () => ({ 
        start: startOfYear(subMonths(new Date(), 12)), 
        end: endOfYear(subMonths(new Date(), 12)) 
      }) 
    }
  ];

  /**
   * Get initial report options
   */
  static getInitialOptions(): ReportOptions {
    return {
      title: `Financial Report - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      dateRange: {
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
      },
      sections: this.DEFAULT_SECTIONS,
      format: 'pdf',
      includeCharts: true,
      includeTransactions: false,
      groupBy: 'category'
    };
  }

  /**
   * Calculate report data
   */
  static calculateReportData(
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[],
    goals: Goal[],
    dateRange: { start: Date; end: Date }
  ): ReportData {
    const { start, end } = dateRange;
    
    // Filter transactions by date range
    const filteredTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= start && date <= end;
    });

    // Calculate totals
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0));

    const totalAssets = accounts
      .filter(a => a.balance > 0)
      .reduce((sum, a) => sum.plus(toDecimal(a.balance)), toDecimal(0));

    const totalLiabilities = accounts
      .filter(a => a.balance < 0)
      .reduce((sum, a) => sum.plus(toDecimal(Math.abs(a.balance))), toDecimal(0));

    const netWorth = totalAssets.minus(totalLiabilities);
    const cashFlow = income.minus(expenses);
    const savingsRate = income.greaterThan(0) ? cashFlow.dividedBy(income).times(100) : toDecimal(0);

    // Budget performance
    const budgetPerformance = budgets.map(budget => {
      const spent = toDecimal(budget.spent || 0);
      const amount = toDecimal(budget.amount);
      const remaining = amount.minus(spent);
      const percentUsed = amount.greaterThan(0) ? spent.dividedBy(amount).times(100) : toDecimal(0);
      
      return {
        ...budget,
        spent: spent.toNumber(),
        remaining: remaining.toNumber(),
        percentUsed: percentUsed.toNumber(),
        isOverBudget: spent.greaterThan(amount)
      };
    });

    // Goal progress
    const goalProgress = goals.map(goal => {
      const current = toDecimal(goal.currentAmount || 0);
      const target = toDecimal(goal.targetAmount);
      const progress = target.greaterThan(0) ? current.dividedBy(target).times(100) : toDecimal(0);
      
      return {
        ...goal,
        progress: progress.toNumber(),
        remaining: target.minus(current).toNumber(),
        isCompleted: current.greaterThanOrEqualTo(target)
      };
    });

    return {
      income: income.toNumber(),
      expenses: expenses.toNumber(),
      cashFlow: cashFlow.toNumber(),
      savingsRate: savingsRate.toNumber(),
      netWorth: netWorth.toNumber(),
      totalAssets: totalAssets.toNumber(),
      totalLiabilities: totalLiabilities.toNumber(),
      transactionCount: filteredTransactions.length,
      budgetPerformance,
      goalProgress,
      filteredTransactions
    };
  }

  /**
   * Prepare export data
   */
  static prepareExportData(
    reportOptions: ReportOptions,
    reportData: ReportData
  ) {
    return {
      reportTitle: reportOptions.title,
      generatedAt: new Date(),
      dateRange: reportOptions.dateRange,
      summary: {
        netWorth: reportData.netWorth,
        totalAssets: reportData.totalAssets,
        totalLiabilities: reportData.totalLiabilities,
        monthlyIncome: reportData.income,
        monthlyExpenses: reportData.expenses,
        cashFlow: reportData.cashFlow,
        savingsRate: reportData.savingsRate
      },
      sections: reportOptions.sections.filter(s => s.enabled),
      data: reportData
    };
  }
}