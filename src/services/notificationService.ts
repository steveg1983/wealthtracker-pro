import Decimal from 'decimal.js';
import type { Transaction, Budget, Goal, Account, Category } from '../types';
import type { Notification } from '../contexts/NotificationContext';
import type { JsonValue, UnknownObject } from '../types/common';
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';

export interface NotificationRule {
  id: string;
  name: string;
  type: 'budget' | 'transaction' | 'goal' | 'account' | 'recurring';
  enabled: boolean;
  conditions: NotificationCondition[];
  actions: NotificationAction[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  cooldown?: number; // Minutes between similar notifications
  created: Date;
  lastTriggered?: Date;
}

export interface NotificationCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'percentage_of' | 'date_range';
  value: JsonValue;
  description: string;
}

export interface NotificationAction {
  type: 'show_notification' | 'send_email' | 'play_sound' | 'mark_urgent';
  config: {
    title: string;
    message: string;
    icon?: string;
    sound?: string;
    actionButton?: {
      label: string;
      action: string;
    };
  };
}

export interface BudgetAlertConfig {
  warningThreshold: number; // Percentage (e.g., 80)
  dangerThreshold: number; // Percentage (e.g., 100)
  enableMonthlyReset: boolean;
  enableProjectedOverspend: boolean;
  enableCategoryComparison: boolean;
}

export interface TransactionAlertConfig {
  largeTransactionThreshold: number;
  unusualSpendingEnabled: boolean;
  duplicateDetectionEnabled: boolean;
  merchantAlertEnabled: boolean;
  foreignTransactionEnabled: boolean;
}

export interface GoalCelebrationConfig {
  milestonePercentages: number[]; // e.g., [25, 50, 75, 100]
  enableCompletionCelebration: boolean;
  enableMilestoneNotifications: boolean;
  enableProgressReminders: boolean;
}

class NotificationService {
  private rules: NotificationRule[] = [];
  private budgetAlertConfig: BudgetAlertConfig = {
    warningThreshold: 80,
    dangerThreshold: 100,
    enableMonthlyReset: true,
    enableProjectedOverspend: true,
    enableCategoryComparison: true
  };
  private transactionAlertConfig: TransactionAlertConfig = {
    largeTransactionThreshold: 500,
    unusualSpendingEnabled: true,
    duplicateDetectionEnabled: true
  };
  private goalCelebrationConfig: GoalCelebrationConfig = {
    milestonePercentages: [25, 50, 75, 100],
    enableSoundEffects: false,
    enableProgressReminders: true
  };

  constructor() {
    this.loadConfig();
    this.loadRules();
  }

  private loadConfig() {
    // Load budget alert configuration
    this.budgetAlertConfig = {
      warningThreshold: 80,
      dangerThreshold: 100,
      enableMonthlyReset: true,
      enableProjectedOverspend: true,
      enableCategoryComparison: true,
      ...this.loadFromStorage('notificationService_budgetConfig')
    };

    // Load transaction alert configuration
    this.transactionAlertConfig = {
      largeTransactionThreshold: 500,
      unusualSpendingEnabled: true,
      duplicateDetectionEnabled: true,
      merchantAlertEnabled: false,
      foreignTransactionEnabled: true,
      ...this.loadFromStorage('notificationService_transactionConfig')
    };

    // Load goal celebration configuration
    this.goalCelebrationConfig = {
      milestonePercentages: [25, 50, 75, 100],
      enableCompletionCelebration: true,
      enableMilestoneNotifications: true,
      enableProgressReminders: true,
      ...this.loadFromStorage('notificationService_goalConfig')
    };
  }

  private loadRules() {
    const storedRules = this.loadFromStorage('notificationService_rules');
    this.rules = Array.isArray(storedRules) ? storedRules as NotificationRule[] : this.getDefaultRules();
  }

  private loadFromStorage(key: string): Record<string, unknown> {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private saveToStorage(key: string, data: JsonValue) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  private getDefaultRules(): NotificationRule[] {
    return [
      {
        id: 'budget-warning',
        name: 'Budget Warning Alert',
        type: 'budget',
        enabled: true,
        conditions: [
          {
            field: 'percentage_spent',
            operator: 'greater_than',
            value: this.budgetAlertConfig.warningThreshold,
            description: `Spent more than ${this.budgetAlertConfig.warningThreshold}% of budget`
          }
        ],
        actions: [
          {
            type: 'show_notification',
            config: {
              title: 'Budget Warning',
              message: 'You\'re approaching your budget limit',
              actionButton: {
                label: 'View Budget',
                action: '/budget'
              }
            }
          }
        ],
        priority: 'medium',
        cooldown: 60, // 1 hour
        created: new Date()
      },
      {
        id: 'budget-exceeded',
        name: 'Budget Exceeded Alert',
        type: 'budget',
        enabled: true,
        conditions: [
          {
            field: 'percentage_spent',
            operator: 'greater_than',
            value: this.budgetAlertConfig.dangerThreshold,
            description: `Exceeded budget limit`
          }
        ],
        actions: [
          {
            type: 'show_notification',
            config: {
              title: 'Budget Exceeded!',
              message: 'You\'ve exceeded your budget for this category',
              actionButton: {
                label: 'Review Spending',
                action: '/budget'
              }
            }
          }
        ],
        priority: 'high',
        cooldown: 30, // 30 minutes
        created: new Date()
      },
      {
        id: 'large-transaction',
        name: 'Large Transaction Alert',
        type: 'transaction',
        enabled: true,
        conditions: [
          {
            field: 'amount',
            operator: 'greater_than',
            value: this.transactionAlertConfig.largeTransactionThreshold,
            description: `Transaction amount exceeds £${this.transactionAlertConfig.largeTransactionThreshold}`
          }
        ],
        actions: [
          {
            type: 'show_notification',
            config: {
              title: 'Large Transaction Detected',
              message: 'A large transaction was recorded',
              actionButton: {
                label: 'Review Transaction',
                action: '/transactions'
              }
            }
          }
        ],
        priority: 'medium',
        cooldown: 5, // 5 minutes
        created: new Date()
      },
      {
        id: 'goal-milestone',
        name: 'Goal Milestone Celebration',
        type: 'goal',
        enabled: true,
        conditions: [
          {
            field: 'percentage_complete',
            operator: 'percentage_of',
            value: this.goalCelebrationConfig.milestonePercentages,
            description: 'Goal milestone reached'
          }
        ],
        actions: [
          {
            type: 'show_notification',
            config: {
              title: '🎉 Goal Milestone Reached!',
              message: 'Congratulations on your progress!',
              actionButton: {
                label: 'View Goals',
                action: '/goals'
              }
            }
          }
        ],
        priority: 'medium',
        cooldown: 60, // 1 hour
        created: new Date()
      },
      {
        id: 'goal-completed',
        name: 'Goal Completion Celebration',
        type: 'goal',
        enabled: true,
        conditions: [
          {
            field: 'percentage_complete',
            operator: 'greater_than',
            value: 100,
            description: 'Goal completed'
          }
        ],
        actions: [
          {
            type: 'show_notification',
            config: {
              title: '🏆 Goal Completed!',
              message: 'Amazing! You\'ve reached your goal!',
              actionButton: {
                label: 'Celebrate',
                action: '/goals'
              }
            }
          }
        ],
        priority: 'high',
        cooldown: 0, // No cooldown for celebrations
        created: new Date()
      }
    ];
  }

  // Budget Alert Methods
  checkBudgetAlerts(budgets: Budget[], transactions: Transaction[], categories: Category[]): Notification[] {
    const notifications: Notification[] = [];
    const now = new Date();

    budgets.forEach(budget => {
      // Calculate spent amount for this budget
      const spent = this.calculateBudgetSpent(budget, transactions);
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      // Check budget rules
      const applicableRules = this.rules.filter(rule => 
        rule.type === 'budget' && 
        rule.enabled &&
        this.shouldTriggerRule(rule, now)
      );

      applicableRules.forEach(rule => {
        if (this.evaluateConditions(rule.conditions, { 
          percentage_spent: percentage, 
          amount_spent: spent,
          budget_amount: budget.amount,
          category: budget.categoryId,
          period: budget.period
        })) {
          const category = categories.find(c => c.name === budget.categoryId);
          const notification = this.createNotificationFromRule(rule, {
            categoryName: budget.categoryId,
            categoryColor: category?.color || '#6B7280',
            percentage: Math.round(percentage),
            spent,
            budget: budget.amount,
            period: budget.period
          });

          if (notification) {
            notifications.push(notification);
            this.updateRuleLastTriggered(rule.id, now);
          }
        }
      });
    });

    return notifications;
  }

  // Transaction Alert Methods
  checkTransactionAlerts(transaction: Transaction, transactions: Transaction[]): Notification[] {
    const notifications: Notification[] = [];
    const now = new Date();

    const applicableRules = this.rules.filter(rule => 
      rule.type === 'transaction' && 
      rule.enabled &&
      this.shouldTriggerRule(rule, now)
    );

    applicableRules.forEach(rule => {
      if (this.evaluateConditions(rule.conditions, {
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        date: transaction.date
      })) {
        const notification = this.createNotificationFromRule(rule, {
          amount: transaction.amount,
          description: transaction.description,
          category: transaction.category
        });

        if (notification) {
          notifications.push(notification);
          this.updateRuleLastTriggered(rule.id, now);
        }
      }
    });

    // Check for duplicate transactions
    if (this.transactionAlertConfig.duplicateDetectionEnabled) {
      const duplicateNotification = this.checkDuplicateTransaction(transaction, transactions);
      if (duplicateNotification) {
        notifications.push(duplicateNotification);
      }
    }

    return notifications;
  }

  // Goal Celebration Methods
  checkGoalProgress(goals: Goal[], previousGoals?: Goal[]): Notification[] {
    const notifications: Notification[] = [];
    const now = new Date();

    goals.forEach(goal => {
      const currentProgress = this.calculateGoalProgress(goal);
      const previousGoal = previousGoals?.find(g => g.id === goal.id);
      const previousProgress = previousGoal ? this.calculateGoalProgress(previousGoal) : 0;

      // Check for milestone achievements
      if (this.goalCelebrationConfig.enableMilestoneNotifications) {
        const milestoneNotification = this.checkGoalMilestone(goal, currentProgress, previousProgress);
        if (milestoneNotification) {
          notifications.push(milestoneNotification);
        }
      }

      // Check for goal completion
      if (this.goalCelebrationConfig.enableCompletionCelebration && currentProgress >= 100 && previousProgress < 100) {
        const completionNotification = this.createGoalCompletionNotification(goal);
        if (completionNotification) {
          notifications.push(completionNotification);
        }
      }
    });

    return notifications;
  }

  private checkGoalMilestone(goal: Goal, currentProgress: number, previousProgress: number): Notification | null {
    const milestones = this.goalCelebrationConfig.milestonePercentages;
    
    for (const milestone of milestones) {
      if (currentProgress >= milestone && previousProgress < milestone && milestone < 100) {
        return {
          id: `goal-milestone-${goal.id}-${milestone}`,
          type: 'success',
          title: `🎯 ${milestone}% Goal Progress!`,
          message: `You're ${milestone}% of the way to "${goal.name}"! Keep it up!`,
          timestamp: new Date(),
          read: false,
          action: {
            label: 'View Goal',
            onClick: () => {
              window.location.href = '/goals';
            }
          }
        };
      }
    }

    return null;
  }

  private createGoalCompletionNotification(goal: Goal): Notification {
    return {
      id: `goal-completed-${goal.id}`,
      type: 'success',
      title: '🏆 Goal Achieved!',
      message: `Congratulations! You've completed "${goal.name}"! Time to celebrate! 🎉`,
      timestamp: new Date(),
      read: false,
      action: {
        label: 'View Achievement',
        onClick: () => {
          window.location.href = '/goals';
        }
      }
    };
  }

  private checkDuplicateTransaction(transaction: Transaction, existingTransactions: Transaction[]): Notification | null {
    const potentialDuplicates = existingTransactions.filter(t => 
      t.id !== transaction.id &&
      Math.abs(t.amount - transaction.amount) < 0.01 &&
      t.description === transaction.description &&
      Math.abs(new Date(t.date).getTime() - new Date(transaction.date).getTime()) < 24 * 60 * 60 * 1000 // Within 24 hours
    );

    if (potentialDuplicates.length > 0) {
      return {
        id: `duplicate-transaction-${transaction.id}`,
        type: 'warning',
        title: 'Possible Duplicate Transaction',
        message: `Similar transaction detected: ${transaction.description} (£${transaction.amount})`,
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

  private calculateBudgetSpent(budget: Budget, transactions: Transaction[]): number {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (budget.period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
    }

    return transactions
      .filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transaction.category === budget.categoryId &&
               transaction.type === 'expense' &&
               transactionDate >= startDate &&
               transactionDate <= endDate;
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  private calculateGoalProgress(goal: Goal): number {
    if (goal.targetAmount <= 0) return 0;
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  }

  private shouldTriggerRule(rule: NotificationRule, now: Date): boolean {
    if (!rule.cooldown || !rule.lastTriggered) return true;
    
    const timeSinceLastTrigger = now.getTime() - rule.lastTriggered.getTime();
    const cooldownMs = rule.cooldown * 60 * 1000; // Convert minutes to milliseconds
    
    return timeSinceLastTrigger >= cooldownMs;
  }

  private evaluateConditions(conditions: NotificationCondition[], data: UnknownObject): boolean {
    return conditions.every(condition => {
      const value = data[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'greater_than':
          return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
        case 'less_than':
          return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'percentage_of':
          if (Array.isArray(condition.value) && typeof value === 'number') {
            return condition.value.some(threshold => typeof threshold === 'number' && Math.abs(value - threshold) < 1);
          }
          return typeof value === 'number' && typeof condition.value === 'number' && Math.abs(value - condition.value) < 1;
        default:
          return false;
      }
    });
  }

  private createNotificationFromRule(rule: NotificationRule, context: UnknownObject): Notification | null {
    const action = rule.actions.find(a => a.type === 'show_notification');
    if (!action) return null;

    const title = this.interpolateString(action.config.title, context);
    const message = this.interpolateString(action.config.message, context);

    return {
      id: `rule-${rule.id}-${Date.now()}`,
      type: this.mapPriorityToType(rule.priority),
      title,
      message,
      timestamp: new Date(),
      read: false,
      action: action.config.actionButton ? {
        label: action.config.actionButton.label,
        onClick: () => {
          if (action.config.actionButton) {
            window.location.href = action.config.actionButton.action;
          }
        }
      } : undefined
    };
  }

  private interpolateString(template: string, context: UnknownObject): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = context[key];
      if (typeof value === 'number' && key.includes('amount')) {
        return formatCurrencyDecimal(value, 'GBP');
      }
      return String(value || match);
    });
  }

  private mapPriorityToType(priority: string): 'info' | 'success' | 'warning' | 'error' {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'info';
    }
  }

  private updateRuleLastTriggered(ruleId: string, timestamp: Date) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.lastTriggered = timestamp;
      this.saveRules();
    }
  }

  private saveRules() {
    this.saveToStorage('notificationService_rules', JSON.parse(JSON.stringify(this.rules)));
  }

  // Configuration Methods
  updateBudgetConfig(config: Partial<BudgetAlertConfig>) {
    this.budgetAlertConfig = { ...this.budgetAlertConfig, ...config };
    this.saveToStorage('notificationService_budgetConfig', JSON.parse(JSON.stringify(this.budgetAlertConfig)));
  }

  updateTransactionConfig(config: Partial<TransactionAlertConfig>) {
    this.transactionAlertConfig = { ...this.transactionAlertConfig, ...config };
    this.saveToStorage('notificationService_transactionConfig', JSON.parse(JSON.stringify(this.transactionAlertConfig)));
  }

  updateGoalConfig(config: Partial<GoalCelebrationConfig>) {
    this.goalCelebrationConfig = { ...this.goalCelebrationConfig, ...config };
    this.saveToStorage('notificationService_goalConfig', JSON.parse(JSON.stringify(this.goalCelebrationConfig)));
  }

  // Rule Management
  getRules(): NotificationRule[] {
    return [...this.rules];
  }

  addRule(rule: Omit<NotificationRule, 'id' | 'created'>): NotificationRule {
    const newRule: NotificationRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      created: new Date()
    };
    
    this.rules.push(newRule);
    this.saveRules();
    return newRule;
  }

  updateRule(ruleId: string, updates: Partial<NotificationRule>): boolean {
    const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return false;

    this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    this.saveRules();
    return true;
  }

  deleteRule(ruleId: string): boolean {
    const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return false;

    this.rules.splice(ruleIndex, 1);
    this.saveRules();
    return true;
  }

  // Getters for configurations
  getBudgetConfig(): BudgetAlertConfig {
    return { ...this.budgetAlertConfig };
  }

  getTransactionConfig(): TransactionAlertConfig {
    return { ...this.transactionAlertConfig };
  }

  getGoalConfig(): GoalCelebrationConfig {
    return { ...this.goalCelebrationConfig };
  }
}

export const notificationService = new NotificationService();
