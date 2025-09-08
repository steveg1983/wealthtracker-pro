/**
 * Budget Comparison Service
 * Handles budget vs actual calculations and comparisons
 */

import type { Budget, Transaction } from '../types';

export interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentUsed: number;
  isOverBudget: boolean;
  remaining: number;
}

export interface BudgetTotals {
  budgeted: number;
  actual: number;
  variance: number;
  percentUsed: number;
  isOverBudget: boolean;
}

export interface PeriodDates {
  startDate: Date;
  endDate: Date;
}

class BudgetComparisonService {
  /**
   * Calculate period dates based on period type
   */
  getPeriodDates(period: 'current' | 'last' | 'year' = 'current'): PeriodDates {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (period) {
      case 'last':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'current':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
    }
    
    return { startDate, endDate };
  }

  /**
   * Calculate budget comparisons for all categories
   */
  calculateBudgetComparisons(
    budgets: Budget[],
    transactions: Transaction[],
    periodDates: PeriodDates
  ): BudgetComparison[] {
    const activeBudgets = budgets.filter(b => b.isActive);
    const comparisons: BudgetComparison[] = [];
    
    activeBudgets.forEach(budget => {
      // Filter transactions for this budget's category and period
      const categoryTransactions = transactions.filter(t => {
        const transDate = new Date(t.date);
        return t.category === ((budget as any).categoryId || (budget as any).category) &&
               t.type === 'expense' &&
               transDate >= periodDates.startDate &&
               transDate <= periodDates.endDate;
      });
      
      const actual = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const variance = budget.amount - actual;
      const percentUsed = budget.amount > 0 ? (actual / budget.amount) * 100 : 0;
      
      comparisons.push({
        category: (budget as any).name || (budget as any).categoryId || (budget as any).category,
        budgeted: budget.amount,
        actual,
        variance,
        percentUsed,
        isOverBudget: actual > budget.amount,
        remaining: Math.max(0, variance)
      });
    });
    
    // Sort by variance (most over budget first)
    return comparisons.sort((a, b) => a.variance - b.variance);
  }

  /**
   * Calculate budget totals
   */
  calculateTotals(budgetComparisons: BudgetComparison[]): BudgetTotals {
    const totalBudgeted = budgetComparisons.reduce((sum, b) => sum + b.budgeted, 0);
    const totalActual = budgetComparisons.reduce((sum, b) => sum + b.actual, 0);
    const totalVariance = totalBudgeted - totalActual;
    const percentUsed = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;
    
    return {
      budgeted: totalBudgeted,
      actual: totalActual,
      variance: totalVariance,
      percentUsed,
      isOverBudget: totalActual > totalBudgeted
    };
  }

  /**
   * Get categories that are over budget
   */
  getOverBudgetCategories(comparisons: BudgetComparison[]): BudgetComparison[] {
    return comparisons.filter(b => b.isOverBudget);
  }

  /**
   * Get categories that are under budget with low usage
   */
  getUnderBudgetCategories(comparisons: BudgetComparison[], threshold = 90): BudgetComparison[] {
    return comparisons.filter(b => !b.isOverBudget && b.percentUsed < threshold);
  }

  /**
   * Get progress bar color based on percentage used
   */
  getProgressBarColor(percentUsed: number, isOverBudget: boolean): string {
    if (isOverBudget) return 'bg-red-500';
    if (percentUsed > 90) return 'bg-yellow-500';
    if (percentUsed > 80) return 'bg-yellow-500';
    return 'bg-gray-500';
  }

  /**
   * Get status color classes based on budget state
   */
  getStatusColorClasses(percentUsed: number, isOverBudget: boolean) {
    const base = {
      background: '',
      text: '',
      progress: ''
    };

    if (isOverBudget) {
      base.background = 'bg-red-50 dark:bg-red-900/20';
      base.text = 'text-red-600 dark:text-red-400';
      base.progress = 'bg-red-500';
    } else if (percentUsed > 80) {
      base.background = 'bg-yellow-50 dark:bg-yellow-900/20';
      base.text = 'text-yellow-600 dark:text-yellow-400';
      base.progress = 'bg-yellow-500';
    } else {
      base.background = 'bg-green-50 dark:bg-green-900/20';
      base.text = 'text-green-600 dark:text-green-400';
      base.progress = 'bg-green-500';
    }

    return base;
  }

  /**
   * Format category URL for navigation
   */
  formatCategoryUrl(category: string): string {
    return `/budget?category=${encodeURIComponent(category)}`;
  }
}

export const budgetComparisonService = new BudgetComparisonService();
