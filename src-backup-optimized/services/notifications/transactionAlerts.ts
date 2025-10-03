/**
 * Transaction Alerts Module
 * Handles transaction-related notifications and alerts
 */

import type { Transaction } from '../../types';
import type { Notification } from '../../contexts/NotificationContext';
import type { 
  TransactionAlertConfig, 
  NotificationRule,
  NotificationCondition 
} from './types';
import { lazyLogger as logger } from '../serviceFactory';

export class TransactionAlerts {
  private config: TransactionAlertConfig;

  constructor(config: TransactionAlertConfig) {
    this.config = config;
  }

  /**
   * Check transaction alerts
   */
  checkTransactionAlerts(
    transaction: Transaction,
    transactions: Transaction[],
    rules: NotificationRule[]
  ): Notification[] {
    const notifications: Notification[] = [];

    // Check for large transactions
    if (transaction.amount >= this.config.largeTransactionThreshold) {
      const largeAlert = this.createLargeTransactionAlert(transaction);
      notifications.push(largeAlert);
    }

    // Check for duplicate transactions
    if (this.config.duplicateDetectionEnabled) {
      const duplicateAlert = this.checkDuplicateTransaction(transaction, transactions);
      if (duplicateAlert) {
        notifications.push(duplicateAlert);
      }
    }

    // Check for unusual spending
    if (this.config.unusualSpendingEnabled) {
      const unusualAlert = this.checkUnusualSpending(transaction, transactions);
      if (unusualAlert) {
        notifications.push(unusualAlert);
      }
    }

    // Check custom rules
    const customAlerts = this.checkCustomRules(transaction, rules);
    notifications.push(...customAlerts);

    return notifications;
  }

  /**
   * Create large transaction alert
   */
  private createLargeTransactionAlert(transaction: Transaction): Notification {
    return {
      id: `large-transaction-${transaction.id}`,
      type: 'warning',
      title: '💰 Large Transaction',
      message: `A large ${transaction.type} of £${transaction.amount.toFixed(2)} was recorded${
        transaction.description ? ` for "${transaction.description}"` : ''
      }`,
      timestamp: new Date(),
      read: false,
      action: {
        label: 'View Details',
        onClick: () => {
          window.location.href = `/transactions/${transaction.id}`;
        }
      }
    };
  }

  /**
   * Check for duplicate transactions
   */
  checkDuplicateTransaction(
    transaction: Transaction,
    existingTransactions: Transaction[]
  ): Notification | null {
    const potentialDuplicates = existingTransactions.filter(t => 
      t.id !== transaction.id &&
      Math.abs(t.amount - transaction.amount) < 0.01 &&
      t.description === transaction.description &&
      Math.abs(new Date(t.date).getTime() - new Date(transaction.date).getTime()) < 24 * 60 * 60 * 1000
    );

    if (potentialDuplicates.length > 0) {
      return {
        id: `duplicate-transaction-${transaction.id}`,
        type: 'warning',
        title: '👥 Possible Duplicate',
        message: `Similar transaction detected: ${transaction.description} (£${transaction.amount.toFixed(2)})`,
        timestamp: new Date(),
        read: false,
        action: {
          label: 'Review Transactions',
          onClick: () => {
            window.location.href = '/transactions';
          }
        }
      };
    }

    return null;
  }

  /**
   * Check for unusual spending patterns
   */
  private checkUnusualSpending(
    transaction: Transaction,
    transactions: Transaction[]
  ): Notification | null {
    if (transaction.type !== 'expense') return null;

    // Get similar category transactions from the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const similarTransactions = transactions.filter(t =>
      t.category === transaction.category &&
      t.type === 'expense' &&
      new Date(t.date) >= thirtyDaysAgo &&
      t.id !== transaction.id
    );

    if (similarTransactions.length < 3) return null;

    // Calculate average and standard deviation
    const amounts = similarTransactions.map(t => t.amount);
    const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - average, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Check if transaction is more than 2 standard deviations above average
    if (transaction.amount > average + (2 * stdDev)) {
      return {
        id: `unusual-spending-${transaction.id}`,
        type: 'info',
        title: '📊 Unusual Spending Detected',
        message: `This ${transaction.category} transaction is ${
          Math.round((transaction.amount / average - 1) * 100)
        }% higher than your average`,
        timestamp: new Date(),
        read: false,
        action: {
          label: 'View Spending Trends',
          onClick: () => {
            window.location.href = `/analytics?category=${transaction.category}`;
          }
        }
      };
    }

    return null;
  }

  /**
   * Check recurring transaction detection
   */
  checkRecurringTransaction(
    transaction: Transaction,
    transactions: Transaction[]
  ): Notification | null {
    if (!this.config.recurringDetectionEnabled) return null;

    // Look for similar transactions in previous months
    const similarTransactions = transactions.filter(t =>
      t.id !== transaction.id &&
      Math.abs(t.amount - transaction.amount) < 1 &&
      (t.description === transaction.description || t.merchant === transaction.merchant)
    );

    // Group by month
    const monthlyOccurrences = new Map<string, number>();
    similarTransactions.forEach(t => {
      const monthKey = new Date(t.date).toISOString().substring(0, 7);
      monthlyOccurrences.set(monthKey, (monthlyOccurrences.get(monthKey) || 0) + 1);
    });

    // If found in 3+ different months, likely recurring
    if (monthlyOccurrences.size >= 3) {
      return {
        id: `recurring-detected-${transaction.id}`,
        type: 'info',
        title: '🔄 Recurring Transaction Detected',
        message: `"${transaction.description}" appears to be a recurring transaction`,
        timestamp: new Date(),
        read: false,
        action: {
          label: 'Set as Recurring',
          onClick: () => {
            window.location.href = `/transactions/${transaction.id}/make-recurring`;
          }
        }
      };
    }

    return null;
  }

  /**
   * Check custom transaction rules
   */
  private checkCustomRules(
    transaction: Transaction,
    rules: NotificationRule[]
  ): Notification[] {
    const notifications: Notification[] = [];
    const applicableRules = rules.filter(r => r.type === 'transaction' && r.enabled);

    applicableRules.forEach(rule => {
      if (this.evaluateConditions(rule.conditions, {
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        date: transaction.date,
        merchant: transaction.merchant
      })) {
        const notification = this.createNotificationFromRule(rule, transaction);
        if (notification) {
          notifications.push(notification);
        }
      }
    });

    return notifications;
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
          return condition.value !== null && value > condition.value;
        case 'less_than':
          return condition.value !== null && value < condition.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
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
    transaction: Transaction
  ): Notification | null {
    const action = rule.actions.find(a => a.type === 'show_notification');
    if (!action) return null;

    // Replace template variables
    let message = action.config.message;
    message = message.replace('{{amount}}', transaction.amount.toFixed(2));
    message = message.replace('{{description}}', transaction.description || '');
    message = message.replace('{{category}}', transaction.category || '');
    message = message.replace('{{type}}', transaction.type);

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
  updateConfig(config: Partial<TransactionAlertConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const createTransactionAlerts = (config: TransactionAlertConfig) => 
  new TransactionAlerts(config);