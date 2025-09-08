/**
 * Budget Alerts Module
 * Handles budget-related notifications and alerts
 */

import type { Budget, Transaction, Category } from '../../types';
import type { Notification } from '../../contexts/NotificationContext';
import type { 
  BudgetAlertConfig, 
  NotificationRule, 
  NotificationCondition 
} from './types';
import { logger } from '../loggingService';

export class BudgetAlerts {
  private config: BudgetAlertConfig;

  constructor(config: BudgetAlertConfig) {
    this.config = config;
  }

  /**
   * Check budget alerts for all budgets
   */
  checkBudgetAlerts(
    budgets: Budget[], 
    transactions: Transaction[], 
    categories: Category[],
    rules: NotificationRule[]
  ): Notification[] {
    const notifications: Notification[] = [];
    const now = new Date();

    budgets.forEach(budget => {
      // Calculate spent amount for this budget
      const spent = this.calculateBudgetSpent(budget, transactions);
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      // Check basic thresholds
      const basicAlert = this.checkBudgetThresholds(budget, percentage, spent, categories);
      if (basicAlert) {
        notifications.push(basicAlert);
      }

      // Check projected overspend
      if (this.config.enableProjectedOverspend) {
        const projectedAlert = this.checkProjectedOverspend(budget, spent, percentage);
        if (projectedAlert) {
          notifications.push(projectedAlert);
        }
      }

      // Check custom rules
      const customAlerts = this.checkCustomRules(
        budget, 
        percentage, 
        spent, 
        categories, 
        rules.filter(r => r.type === 'budget' && r.enabled)
      );
      notifications.push(...customAlerts);
    });

    return notifications;
  }

  /**
   * Check basic budget thresholds
   */
  private checkBudgetThresholds(
    budget: Budget,
    percentage: number,
    spent: number,
    categories: Category[]
  ): Notification | null {
    const category = categories.find(c => c.id === ((budget as any).categoryId || (budget as any).category));
    
    if (percentage >= this.config.dangerThreshold) {
      return {
        id: `budget-exceeded-${budget.id}`,
        type: 'error',
        title: '🚨 Budget Exceeded!',
        message: `You've exceeded your ${(category?.name || (budget as any).categoryId || (budget as any).category)} budget by £${(spent - budget.amount).toFixed(2)}`,
        timestamp: new Date(),
        read: false,
        action: {
          label: 'View Budget',
          onClick: () => {
            window.location.href = '/budgets';
          }
        }
      };
    } else if (percentage >= this.config.warningThreshold) {
      return {
        id: `budget-warning-${budget.id}`,
        type: 'warning',
        title: '⚠️ Budget Alert',
        message: `You've used ${Math.round(percentage)}% of your ${(category?.name || (budget as any).categoryId || (budget as any).category)} budget`,
        timestamp: new Date(),
        read: false,
        action: {
          label: 'View Budget',
          onClick: () => {
            window.location.href = '/budgets';
          }
        }
      };
    }

    return null;
  }

  /**
   * Check for projected overspend
   */
  private checkProjectedOverspend(
    budget: Budget,
    spent: number,
    percentage: number
  ): Notification | null {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const monthProgress = (dayOfMonth / daysInMonth) * 100;

    // If spending pace exceeds month progress significantly
    if (percentage > monthProgress * 1.2 && percentage < this.config.warningThreshold) {
      const projectedTotal = (spent / dayOfMonth) * daysInMonth;
      const projectedOverspend = projectedTotal - budget.amount;

      if (projectedOverspend > 0) {
        return {
          id: `budget-projected-${budget.id}`,
          type: 'info',
          title: '📊 Spending Pace Alert',
          message: `At current pace, you'll exceed your ${((categories.find(c => c.id === ((budget as any).categoryId || (budget as any).category))?.name) || (budget as any).categoryId || (budget as any).category)} budget by £${projectedOverspend.toFixed(2)}`,
          timestamp: new Date(),
          read: false,
          action: {
            label: 'Adjust Spending',
            onClick: () => {
              window.location.href = '/budgets';
            }
          }
        };
      }
    }

    return null;
  }

  /**
   * Check custom budget rules
   */
  private checkCustomRules(
    budget: Budget,
    percentage: number,
    spent: number,
    categories: Category[],
    rules: NotificationRule[]
  ): Notification[] {
    const notifications: Notification[] = [];
    const categoryId = (budget as any).categoryId || (budget as any).category;
    const category = categories.find(c => c.id === categoryId);

    rules.forEach(rule => {
      if (this.evaluateConditions(rule.conditions, {
        percentage_spent: percentage,
        amount_spent: spent,
        budget_amount: budget.amount,
        category: categoryId,
        period: budget.period
      })) {
        const notification = this.createNotificationFromRule(rule, {
          categoryName: category?.name || categoryId,
          categoryColor: category?.color || '#6B7280',
          percentage: Math.round(percentage),
          spent,
          budget: budget.amount,
          period: budget.period
        });

        if (notification) {
          notifications.push(notification);
        }
      }
    });

    return notifications;
  }

  /**
   * Calculate amount spent for a budget
   */
  private calculateBudgetSpent(budget: Budget, transactions: Transaction[]): number {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (budget.period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (budget.period === 'weekly') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else if (budget.period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
    } else {
      // Default to monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return transactions
      .filter(t => 
        t.type === 'expense' &&
        t.category === ((budget as any).categoryId || (budget as any).category) &&
        new Date(t.date) >= startDate &&
        new Date(t.date) <= endDate
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Evaluate notification conditions
   */
  private evaluateConditions(
    conditions: NotificationCondition[], 
    context: Record<string, any>
  ): boolean {
    return conditions.every(condition => {
      const value = context[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'greater_than':
          return value > condition.value;
        case 'less_than':
          return value < condition.value;
        case 'contains':
          return String(value).includes(String(condition.value));
        case 'percentage_of':
          const [base, percentage] = condition.value as [number, number];
          return value >= (base * percentage / 100);
        default:
          return false;
      }
    });
  }

  /**
   * Create notification from rule
   */
  private createNotificationFromRule(
    rule: NotificationRule,
    context: Record<string, any>
  ): Notification | null {
    const action = rule.actions.find(a => a.type === 'show_notification');
    if (!action) return null;

    // Replace template variables
    let message = action.config.message;
    Object.keys(context).forEach(key => {
      message = message.replace(`{{${key}}}`, String(context[key]));
    });

    return {
      id: `rule-${rule.id}-${Date.now()}`,
      type: rule.priority === 'urgent' ? 'error' : 
            rule.priority === 'high' ? 'warning' : 'info',
      title: action.config.title,
      message,
      timestamp: new Date(),
      read: false,
      action: action.config.actionButton ? {
        label: action.config.actionButton.label,
        onClick: () => {
          window.location.href = action.config.actionButton!.action;
        }
      } : undefined
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BudgetAlertConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const createBudgetAlerts = (config: BudgetAlertConfig) => new BudgetAlerts(config);
