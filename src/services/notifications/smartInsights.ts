/**
 * Smart Insights Module
 * Generates intelligent financial insights and recommendations
 */

import type { Transaction, Budget, Goal, Account } from '../../types';
import type { SmartInsight } from './types';
import { logger } from '../loggingService';

export class SmartInsights {
  /**
   * Generate spending insights
   */
  generateSpendingInsights(
    transactions: Transaction[],
    budgets: Budget[]
  ): SmartInsight[] {
    const insights: SmartInsight[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Recent transactions
    const recentTransactions = transactions.filter(
      t => new Date(t.date) >= thirtyDaysAgo
    );

    // Category spending analysis
    const categorySpending = this.analyzeCategorySpending(recentTransactions);
    const topCategory = categorySpending[0];
    
    if (topCategory && topCategory.amount > 500) {
      insights.push({
        id: `spending-top-category-${Date.now()}`,
        type: 'spending',
        title: 'Top Spending Category',
        message: `You spent £${topCategory.amount.toFixed(2)} on ${topCategory.category} this month, which is ${topCategory.percentage.toFixed(1)}% of your total spending`,
        priority: 'medium',
        actionable: true,
        action: {
          label: 'View Details',
          onClick: () => {
            window.location.href = `/analytics?category=${topCategory.category}`;
          }
        },
        created: new Date()
      });
    }

    // Weekend vs weekday spending
    const weekendInsight = this.analyzeWeekendSpending(recentTransactions);
    if (weekendInsight) {
      insights.push(weekendInsight);
    }

    // Subscription detection
    const subscriptionInsight = this.detectSubscriptions(transactions);
    if (subscriptionInsight) {
      insights.push(subscriptionInsight);
    }

    return insights;
  }

  /**
   * Generate saving insights
   */
  generateSavingInsights(
    transactions: Transaction[],
    goals: Goal[]
  ): SmartInsight[] {
    const insights: SmartInsight[] = [];
    
    // Savings rate analysis
    const savingsRate = this.calculateSavingsRate(transactions);
    
    if (savingsRate < 10) {
      insights.push({
        id: `savings-low-rate-${Date.now()}`,
        type: 'saving',
        title: 'Low Savings Rate',
        message: `Your current savings rate is ${savingsRate.toFixed(1)}%. Financial experts recommend saving at least 20% of income.`,
        priority: 'high',
        actionable: true,
        action: {
          label: 'Set Savings Goal',
          onClick: () => {
            window.location.href = '/goals/new';
          }
        },
        created: new Date()
      });
    } else if (savingsRate > 30) {
      insights.push({
        id: `savings-high-rate-${Date.now()}`,
        type: 'saving',
        title: 'Excellent Savings Rate!',
        message: `You're saving ${savingsRate.toFixed(1)}% of your income. Great job maintaining financial discipline!`,
        priority: 'low',
        actionable: false,
        created: new Date()
      });
    }

    // Goal progress insights
    const goalInsights = this.analyzeGoalProgress(goals);
    insights.push(...goalInsights);

    return insights;
  }

  /**
   * Generate budget optimization insights
   */
  generateBudgetInsights(
    budgets: Budget[],
    transactions: Transaction[]
  ): SmartInsight[] {
    const insights: SmartInsight[] = [];
    
    budgets.forEach(budget => {
      const spent = this.calculateBudgetSpent(budget, transactions);
      const percentage = (spent / budget.amount) * 100;
      
      // Under-utilized budgets
      if (percentage < 50 && this.isDaysPastMidMonth()) {
        insights.push({
          id: `budget-underused-${budget.id}`,
          type: 'budget',
          title: 'Under-utilized Budget',
          message: `You've only used ${percentage.toFixed(1)}% of your ${((budget as any).name || (budget as any).categoryId || (budget as any).category)} budget. Consider reallocating funds.`,
          priority: 'low',
          actionable: true,
          action: {
            label: 'Adjust Budget',
            onClick: () => {
              window.location.href = `/budgets/${budget.id}/edit`;
            }
          },
          created: new Date()
        });
      }
      
      // Consistently exceeded budgets
      const history = this.getBudgetHistory(budget, transactions, 3);
      const exceededCount = history.filter(h => h.exceeded).length;
      
      if (exceededCount >= 2) {
        insights.push({
          id: `budget-consistently-exceeded-${budget.id}`,
          type: 'budget',
          title: 'Budget Needs Adjustment',
          message: `Your ${((budget as any).name || (budget as any).categoryId || (budget as any).category)} budget has been exceeded ${exceededCount} times in the last 3 months. Consider increasing it.`,
          priority: 'medium',
          actionable: true,
          action: {
            label: 'Review Budget',
            onClick: () => {
              window.location.href = `/budgets/${budget.id}/edit`;
            }
          },
          created: new Date()
        });
      }
    });

    return insights;
  }

  /**
   * Analyze category spending
   */
  private analyzeCategorySpending(
    transactions: Transaction[]
  ): Array<{ category: string; amount: number; percentage: number }> {
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    
    const categoryMap = new Map<string, number>();
    expenses.forEach(t => {
      const category = t.category || 'Other';
      categoryMap.set(category, (categoryMap.get(category) || 0) + t.amount);
    });
    
    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / totalExpenses) * 100
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Analyze weekend vs weekday spending
   */
  private analyzeWeekendSpending(transactions: Transaction[]): SmartInsight | null {
    const weekdaySpending = transactions
      .filter(t => {
        const day = new Date(t.date).getDay();
        return t.type === 'expense' && day >= 1 && day <= 5;
      })
      .reduce((sum, t) => sum + t.amount, 0);
    
    const weekendSpending = transactions
      .filter(t => {
        const day = new Date(t.date).getDay();
        return t.type === 'expense' && (day === 0 || day === 6);
      })
      .reduce((sum, t) => sum + t.amount, 0);
    
    const weekdayDays = transactions.filter(t => {
      const day = new Date(t.date).getDay();
      return day >= 1 && day <= 5;
    }).length / 5;
    
    const weekendDays = transactions.filter(t => {
      const day = new Date(t.date).getDay();
      return day === 0 || day === 6;
    }).length / 2;
    
    if (weekdayDays > 0 && weekendDays > 0) {
      const weekdayAvg = weekdaySpending / weekdayDays;
      const weekendAvg = weekendSpending / weekendDays;
      
      if (weekendAvg > weekdayAvg * 2) {
        return {
          id: `spending-weekend-high-${Date.now()}`,
          type: 'spending',
          title: 'High Weekend Spending',
          message: `You spend ${((weekendAvg / weekdayAvg - 1) * 100).toFixed(0)}% more on weekends compared to weekdays.`,
          priority: 'low',
          actionable: true,
          action: {
            label: 'View Patterns',
            onClick: () => {
              window.location.href = '/analytics';
            }
          },
          created: new Date()
        };
      }
    }
    
    return null;
  }

  /**
   * Detect potential subscriptions
   */
  private detectSubscriptions(transactions: Transaction[]): SmartInsight | null {
    const recurringMap = new Map<string, number>();
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const key = `${t.merchant || t.description}-${t.amount}`;
        recurringMap.set(key, (recurringMap.get(key) || 0) + 1);
      });
    
    const potentialSubscriptions = Array.from(recurringMap.entries())
      .filter(([_, count]) => count >= 3)
      .length;
    
    if (potentialSubscriptions > 0) {
      return {
        id: `subscriptions-detected-${Date.now()}`,
        type: 'spending',
        title: 'Recurring Payments Detected',
        message: `Found ${potentialSubscriptions} potential subscriptions. Track them to better manage monthly expenses.`,
        priority: 'medium',
        actionable: true,
        action: {
          label: 'Manage Subscriptions',
          onClick: () => {
            window.location.href = '/subscriptions';
          }
        },
        created: new Date()
      };
    }
    
    return null;
  }

  /**
   * Calculate savings rate
   */
  private calculateSavingsRate(transactions: Transaction[]): number {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    if (income === 0) return 0;
    return ((income - expenses) / income) * 100;
  }

  /**
   * Analyze goal progress
   */
  private analyzeGoalProgress(goals: Goal[]): SmartInsight[] {
    const insights: SmartInsight[] = [];
    const now = new Date();
    
    goals.forEach(goal => {
      const progress = (goal.currentAmount / goal.targetAmount) * 100;
      const daysUntilTarget = Math.floor(
        (new Date(goal.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilTarget < 30 && progress < 80) {
        insights.push({
          id: `goal-behind-${goal.id}`,
          type: 'goal',
          title: 'Goal Behind Schedule',
          message: `"${goal.name}" is ${(80 - progress).toFixed(1)}% behind with only ${daysUntilTarget} days left.`,
          priority: 'high',
          actionable: true,
          action: {
            label: 'Update Goal',
            onClick: () => {
              window.location.href = `/goals/${goal.id}`;
            }
          },
          created: new Date()
        });
      }
    });
    
    return insights;
  }

  /**
   * Calculate budget spent
   */
  private calculateBudgetSpent(budget: Budget, transactions: Transaction[]): number {
    return transactions
      .filter(t => 
        t.type === 'expense' &&
        t.category === ((budget as any).categoryId || (budget as any).category)
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Check if past mid-month
   */
  private isDaysPastMidMonth(): boolean {
    return new Date().getDate() > 15;
  }

  /**
   * Get budget history
   */
  private getBudgetHistory(
    budget: Budget,
    transactions: Transaction[],
    months: number
  ): Array<{ month: string; spent: number; exceeded: boolean }> {
    const history: Array<{ month: string; spent: number; exceeded: boolean }> = [];
    const now = new Date();
    
    for (let i = 0; i < months; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = month.toISOString().substring(0, 7);
      
      const monthTransactions = transactions.filter(t => 
        t.type === 'expense' &&
        t.category === ((budget as any).categoryId || (budget as any).category) &&
        (typeof t.date === 'string' ? t.date : t.date.toISOString()).startsWith(monthStr)
      );
      
      const spent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      history.push({
        month: monthStr,
        spent,
        exceeded: spent > budget.amount
      });
    }
    
    return history;
  }
}

export const smartInsights = new SmartInsights();
