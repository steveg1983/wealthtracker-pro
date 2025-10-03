import type { Transaction, Account, Budget, Goal } from '../types';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subWeeks, subMonths } from 'date-fns';

export interface SummaryData {
  period: 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  totalIncome: DecimalInstance;
  totalExpenses: DecimalInstance;
  netIncome: DecimalInstance;
  topCategories: Array<{
    category: string;
    amount: DecimalInstance;
    percentage: number;
  }>;
  savingsRate: number;
  accountBalances: Array<{
    accountName: string;
    balance: DecimalInstance;
    change: DecimalInstance;
  }>;
  budgetPerformance: Array<{
    budgetName: string;
    spent: DecimalInstance;
    limit: DecimalInstance;
    percentage: number;
  }>;
  goalProgress: Array<{
    goalName: string;
    progress: number;
    amountAdded: DecimalInstance;
  }>;
  unusualTransactions: Array<{
    description: string;
    amount: DecimalInstance;
    date: string;
    isHighAmount: boolean;
  }>;
  comparison: {
    incomeChange: number;
    expenseChange: number;
    savingsChange: number;
  };
}

class FinancialSummaryService {
  private readonly STORAGE_KEY = 'financialSummaries';
  private readonly LAST_SUMMARY_KEY = 'lastSummaryGenerated';

  /**
   * Generate a weekly summary
   */
  generateWeeklySummary(
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[],
    goals: Goal[],
    date: Date = new Date()
  ): SummaryData {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(date, { weekStartsOn: 1 });
    
    const previousStart = startOfWeek(subWeeks(date, 1), { weekStartsOn: 1 });
    const previousEnd = endOfWeek(subWeeks(date, 1), { weekStartsOn: 1 });
    
    return this.generateSummary(
      'weekly',
      start,
      end,
      previousStart,
      previousEnd,
      transactions,
      accounts,
      budgets,
      goals
    );
  }

  /**
   * Generate a monthly summary
   */
  generateMonthlySummary(
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[],
    goals: Goal[],
    date: Date = new Date()
  ): SummaryData {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    
    const previousStart = startOfMonth(subMonths(date, 1));
    const previousEnd = endOfMonth(subMonths(date, 1));
    
    return this.generateSummary(
      'monthly',
      start,
      end,
      previousStart,
      previousEnd,
      transactions,
      accounts,
      budgets,
      goals
    );
  }

  /**
   * Generate summary for a specific period
   */
  private generateSummary(
    period: 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date,
    previousStartDate: Date,
    previousEndDate: Date,
    transactions: Transaction[],
    accounts: Account[],
    budgets: Budget[],
    goals: Goal[]
  ): SummaryData {
    // Filter transactions for current period
    const periodTransactions = transactions.filter(t => {
      const transDate = new Date(t.date);
      return transDate >= startDate && transDate <= endDate;
    });

    // Filter transactions for previous period
    const previousPeriodTransactions = transactions.filter(t => {
      const transDate = new Date(t.date);
      return transDate >= previousStartDate && transDate <= previousEndDate;
    });

    // Calculate totals
    const totalIncome = periodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    const totalExpenses = periodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    const netIncome = totalIncome.minus(totalExpenses);

    // Previous period totals for comparison
    const previousIncome = previousPeriodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    const previousExpenses = previousPeriodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    // Calculate top spending categories
    const categorySpending = new Map<string, DecimalInstance>();
    periodTransactions
      .filter(t => t.type === 'expense' && t.category)
      .forEach(t => {
        const current = categorySpending.get(t.category!) || toDecimal(0);
        categorySpending.set(t.category!, current.plus(toDecimal(t.amount)));
      });

    const topCategories = Array.from(categorySpending.entries())
      .sort((a, b) => b[1].minus(a[1]).toNumber())
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses.greaterThan(0) 
          ? amount.dividedBy(totalExpenses).times(100).toNumber() 
          : 0
      }));

    // Calculate savings rate
    const savingsRate = totalIncome.greaterThan(0)
      ? netIncome.dividedBy(totalIncome).times(100).toNumber()
      : 0;

    // Account balance changes
    const accountBalances = accounts.map(account => {
      const accountTransactions = periodTransactions.filter(t => t.accountId === account.id);
      const income = accountTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
      const expenses = accountTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
      
      return {
        accountName: account.name,
        balance: toDecimal(account.balance),
        change: income.minus(expenses)
      };
    });

    // Budget performance
    const budgetPerformance = budgets.map(budget => {
      const budgetTransactions = periodTransactions.filter(t => 
        t.type === 'expense' && t.category === budget.category
      );
      const spent = budgetTransactions.reduce(
        (sum, t) => sum.plus(toDecimal(t.amount)), 
        toDecimal(0)
      );
      const limit = toDecimal(budget.limit);
      
      return {
        budgetName: budget.name,
        spent,
        limit,
        percentage: limit.greaterThan(0) 
          ? spent.dividedBy(limit).times(100).toNumber() 
          : 0
      };
    });

    // Goal progress
    const goalProgress = goals
      .filter(goal => goal.isActive)
      .map(goal => {
        // Estimate amount added based on linked accounts
        let amountAdded = toDecimal(0);
        if (goal.linkedAccountIds && goal.linkedAccountIds.length > 0) {
          goal.linkedAccountIds.forEach(accountId => {
            const account = accountBalances.find(a => {
              const acc = accounts.find(ac => ac.id === accountId);
              return acc && a.accountName === acc.name;
            });
            if (account && account.change.greaterThan(0)) {
              amountAdded = amountAdded.plus(account.change);
            }
          });
        }
        
        const progress = goal.targetAmount > 0 
          ? (goal.currentAmount / goal.targetAmount) * 100 
          : 0;
        
        return {
          goalName: goal.name,
          progress,
          amountAdded
        };
      });

    // Find unusual transactions (high amounts or unusual patterns)
    const avgTransactionAmount = totalExpenses.dividedBy(
      Math.max(periodTransactions.filter(t => t.type === 'expense').length, 1)
    );
    const threshold = avgTransactionAmount.times(2); // 2x average

    const unusualTransactions = periodTransactions
      .filter(t => {
        const amount = toDecimal(t.amount);
        return amount.greaterThan(threshold) || t.tags?.includes('unusual');
      })
      .map(t => ({
        description: t.description,
        amount: toDecimal(t.amount),
        date: format(new Date(t.date), 'dd MMM'),
        isHighAmount: toDecimal(t.amount).greaterThan(threshold)
      }))
      .slice(0, 5);

    // Calculate comparison percentages
    const comparison = {
      incomeChange: previousIncome.greaterThan(0)
        ? totalIncome.minus(previousIncome).dividedBy(previousIncome).times(100).toNumber()
        : 0,
      expenseChange: previousExpenses.greaterThan(0)
        ? totalExpenses.minus(previousExpenses).dividedBy(previousExpenses).times(100).toNumber()
        : 0,
      savingsChange: previousIncome.greaterThan(0)
        ? netIncome.minus(previousIncome.minus(previousExpenses))
            .dividedBy(previousIncome.minus(previousExpenses).abs())
            .times(100).toNumber()
        : 0
    };

    return {
      period,
      startDate,
      endDate,
      totalIncome,
      totalExpenses,
      netIncome,
      topCategories,
      savingsRate,
      accountBalances,
      budgetPerformance,
      goalProgress,
      unusualTransactions,
      comparison
    };
  }

  /**
   * Save summary to history
   */
  saveSummary(summary: SummaryData): void {
    try {
      const summaries = this.getSummaryHistory();
      summaries.push(summary);
      
      // Keep only last 52 weeks or 12 months
      const maxCount = summary.period === 'weekly' ? 52 : 12;
      if (summaries.length > maxCount) {
        summaries.splice(0, summaries.length - maxCount);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(summaries));
      localStorage.setItem(this.LAST_SUMMARY_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Failed to save summary:', error);
    }
  }

  /**
   * Get summary history
   */
  getSummaryHistory(): SummaryData[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Check if it's time to generate a new summary
   */
  shouldGenerateSummary(period: 'weekly' | 'monthly'): boolean {
    try {
      const lastGenerated = localStorage.getItem(this.LAST_SUMMARY_KEY);
      if (!lastGenerated) return true;
      
      const last = new Date(lastGenerated);
      const now = new Date();
      
      if (period === 'weekly') {
        // Generate on Mondays
        return now.getDay() === 1 && now.getDate() !== last.getDate();
      } else {
        // Generate on the 1st of each month
        return now.getDate() === 1 && now.getMonth() !== last.getMonth();
      }
    } catch {
      return true;
    }
  }

  /**
   * Format summary for display
   */
  formatSummaryText(summary: SummaryData, currencySymbol: string = '£'): string {
    const periodText = summary.period === 'weekly' ? 'This Week' : 'This Month';
    const dateRange = `${format(summary.startDate, 'MMM d')} - ${format(summary.endDate, 'MMM d')}`;
    
    let text = `## ${periodText}'s Financial Summary\n`;
    text += `### ${dateRange}\n\n`;
    
    // Overview
    text += `**Income:** ${currencySymbol}${summary.totalIncome.toFixed(2)}\n`;
    text += `**Expenses:** ${currencySymbol}${summary.totalExpenses.toFixed(2)}\n`;
    text += `**Net:** ${currencySymbol}${summary.netIncome.toFixed(2)}\n`;
    text += `**Savings Rate:** ${summary.savingsRate.toFixed(1)}%\n\n`;
    
    // Comparison
    if (summary.comparison.incomeChange !== 0 || summary.comparison.expenseChange !== 0) {
      text += `### Compared to Last ${summary.period === 'weekly' ? 'Week' : 'Month'}\n`;
      text += `- Income: ${summary.comparison.incomeChange >= 0 ? '+' : ''}${summary.comparison.incomeChange.toFixed(1)}%\n`;
      text += `- Expenses: ${summary.comparison.expenseChange >= 0 ? '+' : ''}${summary.comparison.expenseChange.toFixed(1)}%\n\n`;
    }
    
    // Top spending categories
    if (summary.topCategories.length > 0) {
      text += `### Top Spending Categories\n`;
      summary.topCategories.forEach(cat => {
        text += `- ${cat.category}: ${currencySymbol}${cat.amount.toFixed(2)} (${cat.percentage.toFixed(1)}%)\n`;
      });
      text += '\n';
    }
    
    // Budget alerts
    const overBudget = summary.budgetPerformance.filter(b => b.percentage > 100);
    if (overBudget.length > 0) {
      text += `### ⚠️ Over Budget\n`;
      overBudget.forEach(b => {
        text += `- ${b.budgetName}: ${currencySymbol}${b.spent.toFixed(2)} / ${currencySymbol}${b.limit.toFixed(2)} (${b.percentage.toFixed(0)}%)\n`;
      });
      text += '\n';
    }
    
    // Goal progress
    const activeGoals = summary.goalProgress.filter(g => g.amountAdded.greaterThan(0));
    if (activeGoals.length > 0) {
      text += `### Goal Progress\n`;
      activeGoals.forEach(g => {
        text += `- ${g.goalName}: ${g.progress.toFixed(1)}% (+${currencySymbol}${g.amountAdded.toFixed(2)} this ${summary.period === 'weekly' ? 'week' : 'month'})\n`;
      });
    }
    
    return text;
  }
}

export const financialSummaryService = new FinancialSummaryService();