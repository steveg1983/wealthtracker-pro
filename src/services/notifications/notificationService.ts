/**
 * Notification Service Orchestrator
 * Main coordination point for all notification functionality
 */

import type {
  NotificationRule,
  NotificationTemplate,
  SmartInsight,
  BudgetAlertConfig,
  TransactionAlertConfig,
  GoalCelebrationConfig
} from './types';
import type { Transaction, Budget, Goal, Category, Account } from '../../types';
import type { Notification } from '../../contexts/NotificationContext';

import { BudgetAlerts } from './budgetAlerts';
import { TransactionAlerts } from './transactionAlerts';
import { GoalCelebrations } from './goalCelebrations';
import { SmartInsights } from './smartInsights';
import { RuleEngine } from './ruleEngine';
import { logger } from '../loggingService';

export class NotificationService {
  private budgetAlerts: BudgetAlerts;
  private transactionAlerts: TransactionAlerts;
  private goalCelebrations: GoalCelebrations;
  private smartInsights: SmartInsights;
  private ruleEngine: RuleEngine;
  private notifications: Notification[] = [];
  private subscribers: Set<(notifications: Notification[]) => void> = new Set();

  constructor() {
    try {
      logger.info('NotificationService initializing', {
        componentName: 'NotificationService'
      });
      
      // Initialize with default configurations
      this.budgetAlerts = new BudgetAlerts({
        warningThreshold: 80,
        dangerThreshold: 100,
        enableProjectedOverspend: true,
        enableMonthlyReset: true,
        enableCategoryComparison: true
      });

      this.transactionAlerts = new TransactionAlerts({
        largeTransactionThreshold: 500,
        duplicateDetectionEnabled: true,
        unusualSpendingEnabled: true,
        recurringDetectionEnabled: true,
        merchantAlertEnabled: false,
        foreignTransactionEnabled: false
      });

      this.goalCelebrations = new GoalCelebrations({
        milestonePercentages: [25, 50, 75, 100],
        enableMilestoneNotifications: true,
        enableCompletionCelebration: true,
        enableProgressReminders: true,
        enableStreaks: true
      });

      this.smartInsights = new SmartInsights();
      this.ruleEngine = new RuleEngine();

      this.loadNotifications();
      
      logger.info('NotificationService initialized successfully', {
        componentName: 'NotificationService'
      });
    } catch (error) {
      logger.error('NotificationService initialization failed:', error, 'NotificationService');
      // Initialize with safe defaults
      this.budgetAlerts = {} as BudgetAlerts;
      this.transactionAlerts = {} as TransactionAlerts;
      this.goalCelebrations = {} as GoalCelebrations;
      this.smartInsights = {} as SmartInsights;
      this.ruleEngine = {} as RuleEngine;
      this.notifications = [];
    }
  }

  /**
   * Load stored notifications
   */
  private loadNotifications(): void {
    try {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        const parsedData = JSON.parse(stored);
        if (Array.isArray(parsedData)) {
          this.notifications = parsedData.map((n: any) => {
            try {
              return {
                ...n,
                timestamp: new Date(n.timestamp)
              };
            } catch (mappingError) {
              logger.error('Failed to map notification:', mappingError, 'NotificationService');
              return null;
            }
          }).filter(Boolean);
        } else {
          logger.warn('Invalid notification data format in localStorage', {
            componentName: 'NotificationService'
          });
          this.notifications = [];
        }
      }
    } catch (error) {
      logger.error('Failed to load notifications:', error, 'NotificationService');
      this.notifications = [];
    }
  }

  /**
   * Save notifications to storage
   */
  private saveNotifications(): void {
    try {
      const serializedNotifications = JSON.stringify(this.notifications);
      localStorage.setItem('notifications', serializedNotifications);
      logger.debug('Notifications saved successfully', {
        count: this.notifications.length,
        componentName: 'NotificationService'
      });
    } catch (error) {
      logger.error('Failed to save notifications:', error, 'NotificationService');
    }
  }

  /**
   * Add a notification
   */
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    try {
      if (!notification.title || !notification.type) {
        logger.error('Invalid notification data - missing required fields', {
          notification,
          componentName: 'NotificationService'
        });
        return;
      }
      
      const newNotification: Notification = {
        ...notification,
        id: `notification-${Date.now()}`,
        timestamp: new Date(),
        read: false
      };

      this.notifications.unshift(newNotification);
      
      try {
        this.saveNotifications();
      } catch (saveError) {
        logger.error('Failed to save notification after adding:', saveError, 'NotificationService');
      }
      
      try {
        this.notifySubscribers();
      } catch (notifyError) {
        logger.error('Failed to notify subscribers after adding notification:', notifyError, 'NotificationService');
      }
      
      logger.debug('Notification added successfully', {
        id: newNotification.id,
        type: newNotification.type,
        componentName: 'NotificationService'
      });
    } catch (error) {
      logger.error('Failed to add notification:', error, 'NotificationService');
    }
  }

  /**
   * Process budget changes
   */
  processBudgetUpdate(
    budgets: Budget[],
    transactions: Transaction[],
    categories: Category[]
  ): void {
    const rules = this.ruleEngine.getRulesByType('budget');
    const alerts = this.budgetAlerts.checkBudgetAlerts(
      budgets,
      transactions,
      categories,
      rules
    );

    alerts.forEach(alert => {
      if (!this.isDuplicate(alert)) {
        this.notifications.unshift(alert);
      }
    });

    if (alerts.length > 0) {
      this.saveNotifications();
      this.notifySubscribers();
    }
  }

  /**
   * Process new transaction
   */
  processTransaction(
    transaction: Transaction,
    allTransactions: Transaction[]
  ): void {
    const rules = this.ruleEngine.getRulesByType('transaction');
    const alerts = this.transactionAlerts.checkTransactionAlerts(
      transaction,
      allTransactions,
      rules
    );

    // Check rules
    const context = {
      amount: transaction.amount,
      description: transaction.description,
      category: transaction.category,
      type: transaction.type,
      date: transaction.date,
      merchant: transaction.merchant
    };

    rules.forEach(rule => {
      if (this.ruleEngine.shouldTriggerRule(rule) &&
          this.ruleEngine.evaluateConditions(rule.conditions, context)) {
        const notification = this.ruleEngine.executeActions(rule, context);
        if (notification && !this.isDuplicate(notification)) {
          alerts.push(notification);
        }
      }
    });

    alerts.forEach(alert => {
      if (!this.isDuplicate(alert)) {
        this.notifications.unshift(alert);
      }
    });

    if (alerts.length > 0) {
      this.saveNotifications();
      this.notifySubscribers();
    }
  }

  /**
   * Process goal updates
   */
  processGoalUpdate(goals: Goal[], previousGoals?: Goal[]): void {
    const celebrations = this.goalCelebrations.checkGoalProgress(goals, previousGoals);
    
    celebrations.forEach(celebration => {
      if (!this.isDuplicate(celebration)) {
        this.notifications.unshift(celebration);
      }
    });

    if (celebrations.length > 0) {
      this.saveNotifications();
      this.notifySubscribers();
    }
  }

  /**
   * Generate smart insights
   */
  generateInsights(
    transactions: Transaction[],
    budgets: Budget[],
    goals: Goal[]
  ): SmartInsight[] {
    const insights: SmartInsight[] = [];

    // Generate spending insights
    const spendingInsights = this.smartInsights.generateSpendingInsights(
      transactions,
      budgets
    );
    insights.push(...spendingInsights);

    // Generate saving insights
    const savingInsights = this.smartInsights.generateSavingInsights(
      transactions,
      goals
    );
    insights.push(...savingInsights);

    // Generate budget optimization insights
    const budgetInsights = this.smartInsights.generateBudgetInsights(
      budgets,
      transactions
    );
    insights.push(...budgetInsights);

    return insights;
  }

  /**
   * Check if notification is duplicate
   */
  private isDuplicate(notification: Notification): boolean {
    const recentTime = Date.now() - 5 * 60 * 1000; // 5 minutes
    return this.notifications.some(n =>
      n.title === notification.title &&
      n.message === notification.message &&
      n.timestamp.getTime() > recentTime
    );
  }

  /**
   * Mark notification as read
   */
  markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.saveNotifications();
      this.notifySubscribers();
    }
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.saveNotifications();
    this.notifySubscribers();
  }

  /**
   * Clear notification
   */
  clearNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.saveNotifications();
    this.notifySubscribers();
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications = [];
    this.saveNotifications();
    this.notifySubscribers();
  }

  /**
   * Get notifications
   */
  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Subscribe to notifications
   */
  subscribe(callback: (notifications: Notification[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(): void {
    const notifications = this.getNotifications();
    this.subscribers.forEach(callback => callback(notifications));
  }

  /**
   * Configure budget alerts
   */
  configureBudgetAlerts(config: Partial<BudgetAlertConfig>): void {
    this.budgetAlerts.updateConfig(config);
  }

  /**
   * Configure transaction alerts
   */
  configureTransactionAlerts(config: Partial<TransactionAlertConfig>): void {
    this.transactionAlerts.updateConfig(config);
  }

  /**
   * Configure goal celebrations
   */
  configureGoalCelebrations(config: Partial<GoalCelebrationConfig>): void {
    this.goalCelebrations.updateConfig(config);
  }

  /**
   * Rule management
   */
  addRule(rule: Omit<NotificationRule, 'id' | 'created'>): NotificationRule {
    return this.ruleEngine.addRule(rule);
  }

  updateRule(id: string, updates: Partial<NotificationRule>): boolean {
    return this.ruleEngine.updateRule(id, updates);
  }

  deleteRule(id: string): boolean {
    return this.ruleEngine.deleteRule(id);
  }

  getRules(): NotificationRule[] {
    return this.ruleEngine.getRules();
  }

  getTemplates(): NotificationTemplate[] {
    return this.ruleEngine.getTemplates();
  }

  createRuleFromTemplate(
    templateId: string,
    customizations: {
      name: string;
      conditions: NotificationRule['conditions'];
      enabled?: boolean;
      cooldown?: number;
    }
  ): NotificationRule | null {
    return this.ruleEngine.createRuleFromTemplate(templateId, customizations);
  }
}

// Singleton instance
export const notificationService = new NotificationService();