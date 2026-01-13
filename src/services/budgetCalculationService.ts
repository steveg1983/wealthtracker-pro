import { BaseService } from './base/BaseService';
import Decimal from 'decimal.js';
import type { Budget, Transaction, Category } from '../types';
import { formatDecimal } from '../utils/decimal-format';

export interface BudgetPeriod {
  startDate: Date;
  endDate: Date;
  period: 'monthly' | 'quarterly' | 'yearly';
}

export interface BudgetSpending {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  transactions: Transaction[];
}

export interface BudgetSummary {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  percentageUsed: number;
  budgetsByCategory: BudgetSpending[];
  overBudgetCategories: string[];
  nearLimitCategories: string[];
}

class BudgetCalculationService extends BaseService {
  private readonly WARNING_THRESHOLD = 0.8; // 80%
  private readonly DANGER_THRESHOLD = 1.0; // 100%

  constructor() {
    super('BudgetCalculationService');
  }

  /**
   * Get the current budget period based on budget configuration
   */
  getCurrentPeriod(budget: Budget): BudgetPeriod {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3);

    switch (budget.period) {
      case 'monthly':
        return {
          startDate: new Date(year, month, 1),
          endDate: new Date(year, month + 1, 0, 23, 59, 59),
          period: 'monthly'
        };
      
      case 'quarterly':
        return {
          startDate: new Date(year, quarter * 3, 1),
          endDate: new Date(year, quarter * 3 + 3, 0, 23, 59, 59),
          period: 'quarterly'
        };
      
      case 'yearly':
        return {
          startDate: new Date(year, 0, 1),
          endDate: new Date(year, 11, 31, 23, 59, 59),
          period: 'yearly'
        };
      
      default:
        throw new Error(`Unknown budget period: ${budget.period}`);
    }
  }

  /**
   * Calculate spending for a specific budget
   */
  calculateBudgetSpending(
    budget: Budget,
    transactions: Transaction[],
    categories: Category[]
  ): BudgetSpending {
    const period = this.getCurrentPeriod(budget);
    // Handle legacy data: old budgets may have 'category' instead of 'categoryId'
    const budgetCategoryId = budget.categoryId || (budget as { category?: string }).category || '';
    // Handle legacy data: old budgets may have 'limit' instead of 'amount'
    const budgetLimitValue = budget.amount ?? (budget as { limit?: number }).limit ?? 0;
    const category = categories.find(c => c.id === budgetCategoryId);
    
    // Filter transactions for this budget's category and period
    const budgetTransactions = this.filterTransactionsForBudget(
      transactions,
      budget,
      period
    );

    // Calculate spending
    const spentAmount = this.calculateTotalSpent(budgetTransactions);
    const budgetAmountDecimal = new Decimal(budgetLimitValue);
    const remainingAmount = budgetAmountDecimal.minus(spentAmount).toNumber();
    const percentageUsed = budgetAmountDecimal.greaterThan(0)
      ? new Decimal(spentAmount).dividedBy(budgetAmountDecimal).times(100).toNumber()
      : 0;

    return {
      budgetId: budget.id,
      categoryId: budgetCategoryId,
      categoryName: category?.name || 'Unknown',
      budgetAmount: budgetAmountDecimal.toNumber(),
      spentAmount,
      remainingAmount,
      percentageUsed,
      isOverBudget: percentageUsed >= this.DANGER_THRESHOLD * 100,
      isNearLimit: percentageUsed >= this.WARNING_THRESHOLD * 100,
      transactions: budgetTransactions
    };
  }

  /**
   * Calculate spending for all budgets
   */
  calculateAllBudgetSpending(
    budgets: Budget[],
    transactions: Transaction[],
    categories: Category[]
  ): BudgetSummary {
    const budgetsByCategory = budgets.map(budget =>
      this.calculateBudgetSpending(budget, transactions, categories)
    );

    const totalBudgeted = budgetsByCategory.reduce(
      (sum, b) => new Decimal(sum).plus(b.budgetAmount).toNumber(),
      0
    );

    const totalSpent = budgetsByCategory.reduce(
      (sum, b) => new Decimal(sum).plus(b.spentAmount).toNumber(),
      0
    );

    const totalRemaining = new Decimal(totalBudgeted).minus(totalSpent).toNumber();
    const percentageUsed = totalBudgeted > 0
      ? new Decimal(totalSpent).dividedBy(totalBudgeted).times(100).toNumber()
      : 0;

    const overBudgetCategories = budgetsByCategory
      .filter(b => b.isOverBudget)
      .map(b => b.categoryName);

    const nearLimitCategories = budgetsByCategory
      .filter(b => b.isNearLimit && !b.isOverBudget)
      .map(b => b.categoryName);

    return {
      totalBudgeted,
      totalSpent,
      totalRemaining,
      percentageUsed,
      budgetsByCategory,
      overBudgetCategories,
      nearLimitCategories
    };
  }

  /**
   * Filter transactions for a specific budget and period
   */
  private filterTransactionsForBudget(
    transactions: Transaction[],
    budget: Budget,
    period: BudgetPeriod
  ): Transaction[] {
    // Handle legacy data: old budgets may have 'category' instead of 'categoryId'
    const budgetCategoryId = budget.categoryId || (budget as { category?: string }).category;
    return transactions.filter(transaction => {
      // Must be an expense
      if (transaction.type !== 'expense') return false;
      
      // Must match category
      if (budgetCategoryId && transaction.category !== budgetCategoryId) return false;
      
      // Must be within period
      const transactionDate = new Date(transaction.date);
      return transactionDate >= period.startDate && transactionDate <= period.endDate;
    });
  }

  /**
   * Calculate total spent from transactions
   */
  private calculateTotalSpent(transactions: Transaction[]): number {
    return transactions.reduce((sum, transaction) => {
      return new Decimal(sum).plus(transaction.amount).toNumber();
    }, 0);
  }

  /**
   * Get budget alerts based on current spending
   */
  getBudgetAlerts(budgetSummary: BudgetSummary): string[] {
    const alerts: string[] = [];

    if (budgetSummary.overBudgetCategories.length > 0) {
      alerts.push(
        `Over budget in: ${budgetSummary.overBudgetCategories.join(', ')}`
      );
    }

    if (budgetSummary.nearLimitCategories.length > 0) {
      alerts.push(
        `Near budget limit in: ${budgetSummary.nearLimitCategories.join(', ')}`
      );
    }

    if (budgetSummary.percentageUsed > 90) {
      alerts.push(
        `Overall budget usage at ${formatDecimal(budgetSummary.percentageUsed, 1)}%`
      );
    }

    return alerts;
  }

  /**
   * Project end-of-period spending based on current rate
   */
  projectEndOfPeriodSpending(
    budget: Budget,
    currentSpending: number,
    period: BudgetPeriod
  ): number {
    const now = new Date();
    const periodStart = period.startDate;
    const periodEnd = period.endDate;
    
    // Calculate days elapsed and total days in period
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate daily spending rate
    const dailyRate = new Decimal(currentSpending).dividedBy(daysElapsed);
    
    // Project total spending
    return dailyRate.times(totalDays).toNumber();
  }

  /**
   * Get spending by category for a period
   */
  getSpendingByCategory(
    transactions: Transaction[],
    categories: Category[],
    startDate: Date,
    endDate: Date
  ): Map<string, { category: Category; amount: number }> {
    const spendingMap = new Map<string, { category: Category; amount: number }>();

    // Initialize map with all categories
    categories.forEach(category => {
      spendingMap.set(category.id, { category, amount: 0 });
    });

    // Calculate spending
    transactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
      })
      .forEach(transaction => {
        const entry = spendingMap.get(transaction.category);
        if (entry) {
          entry.amount = new Decimal(entry.amount)
            .plus(transaction.amount)
            .toNumber();
        }
      });

    return spendingMap;
  }

  /**
   * Compare spending between periods
   */
  compareSpendingPeriods(
    currentPeriodSpending: number,
    previousPeriodSpending: number
  ): {
    difference: number;
    percentageChange: number;
    trend: 'increase' | 'decrease' | 'stable';
  } {
    const difference = new Decimal(currentPeriodSpending)
      .minus(previousPeriodSpending)
      .toNumber();
    
    const percentageChange = previousPeriodSpending > 0
      ? new Decimal(difference)
          .dividedBy(previousPeriodSpending)
          .times(100)
          .toNumber()
      : 0;

    let trend: 'increase' | 'decrease' | 'stable';
    if (Math.abs(percentageChange) < 5) {
      trend = 'stable';
    } else if (percentageChange > 0) {
      trend = 'increase';
    } else {
      trend = 'decrease';
    }

    return { difference, percentageChange, trend };
  }
}

export const budgetCalculationService = new BudgetCalculationService();
