import type { Budget, Transaction } from '../types';

export interface SpendingVelocity {
  dailyAverage: number;
  projectedTotal: number;
  daysRemaining: number;
  percentOfPeriodElapsed: number;
  isOnTrack: boolean;
  willExceed: boolean;
  recommendedDailyLimit: number;
}

export interface BudgetMetrics {
  spent: number;
  remaining: number;
  percentage: number;
  velocity: SpendingVelocity;
}

/**
 * Service for budget progress calculations and analysis
 */
export class BudgetProgressService {
  /**
   * Calculate spending for a budget
   */
  static calculateSpending(
    transactions: Transaction[],
    budget: Budget
  ): number {
    return transactions
      .filter(t => 
        t.category === (budget as any).categoryId &&
        t.type === 'expense' &&
        new Date(t.date) >= new Date(budget.startDate) &&
        new Date(t.date) <= new Date(budget.endDate)
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  /**
   * Calculate spending velocity and predictions
   */
  static calculateVelocity(budget: Budget, spent: number): SpendingVelocity {
    const now = new Date();
    const start = new Date(budget.startDate);
    const end = new Date(budget.endDate);
    
    // Calculate days
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    
    // Calculate percentages
    const percentOfPeriodElapsed = Math.min(100, (daysElapsed / totalDays) * 100);
    const dailyAverage = daysElapsed > 0 ? spent / daysElapsed : 0;
    
    // Project total spending at current rate
    const projectedTotal = dailyAverage * totalDays;
    
    // Calculate if on track
    const expectedSpending = (budget.amount * percentOfPeriodElapsed) / 100;
    const isOnTrack = spent <= expectedSpending * 1.1; // 10% buffer
    const willExceed = projectedTotal > budget.amount;
    
    // Calculate recommended daily limit for remaining days
    const remainingBudget = Math.max(0, budget.amount - spent);
    const recommendedDailyLimit = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;
    
    return {
      dailyAverage,
      projectedTotal,
      daysRemaining,
      percentOfPeriodElapsed,
      isOnTrack,
      willExceed,
      recommendedDailyLimit
    };
  }

  /**
   * Get progress color based on percentage and velocity
   */
  static getProgressColor(percentage: number, velocity: SpendingVelocity): string {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 60 && !velocity.isOnTrack) return 'bg-yellow-400';
    return 'bg-green-500';
  }

  /**
   * Get status color class
   */
  static getStatusColor(percentage: number): string {
    if (percentage >= 100) return 'text-red-600 dark:text-red-400';
    if (percentage >= 90) return 'text-orange-600 dark:text-orange-400';
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  }

  /**
   * Get status icon name
   */
  static getStatusIcon(percentage: number, velocity: SpendingVelocity): string {
    if (percentage >= 100) return 'AlertTriangleIcon';
    if (velocity.willExceed) return 'TrendingUpIcon';
    if (!velocity.isOnTrack) return 'TrendingDownIcon';
    return 'CheckCircleIcon';
  }

  /**
   * Get status message
   */
  static getStatusMessage(
    percentage: number,
    spent: number,
    budget: Budget,
    velocity: SpendingVelocity,
    formatCurrency: (amount: number) => string
  ): string {
    if (percentage >= 100) {
      return `Over budget by ${formatCurrency(spent - budget.amount)}`;
    }
    if (velocity.willExceed) {
      return `Projected to exceed by ${formatCurrency(velocity.projectedTotal - budget.amount)}`;
    }
    if (!velocity.isOnTrack) {
      return 'Spending faster than planned';
    }
    return 'On track';
  }

  /**
   * Calculate percentage with cap at 100
   */
  static calculatePercentage(spent: number, budgetAmount: number): number {
    return Math.min(100, (spent / budgetAmount) * 100);
  }

  /**
   * Get remaining amount
   */
  static getRemainingAmount(budget: Budget, spent: number): number {
    return Math.max(0, budget.amount - spent);
  }

  /**
   * Format days remaining message
   */
  static formatDaysRemaining(days: number): string {
    if (days === 0) return 'Last day';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  }

  /**
   * Get pace indicator
   */
  static getPaceIndicator(velocity: SpendingVelocity): {
    text: string;
    color: string;
  } {
    if (velocity.willExceed) {
      return { text: 'Over pace', color: 'text-red-600' };
    }
    if (!velocity.isOnTrack) {
      return { text: 'Slightly fast', color: 'text-yellow-600' };
    }
    return { text: 'Good pace', color: 'text-green-600' };
  }

  /**
   * Calculate all budget metrics
   */
  static calculateBudgetMetrics(
    budget: Budget,
    transactions: Transaction[]
  ): BudgetMetrics {
    const spent = this.calculateSpending(transactions, budget);
    const velocity = this.calculateVelocity(budget, spent);
    const percentage = this.calculatePercentage(spent, budget.amount);
    const remaining = this.getRemainingAmount(budget, spent);

    return {
      spent,
      remaining,
      percentage,
      velocity
    };
  }
}
