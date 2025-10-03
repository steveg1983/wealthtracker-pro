/**
 * Notification Service Module
 * Barrel exports for notification functionality
 */

// Main service
export { NotificationService, notificationService } from './notificationService';

// Alert modules
export { BudgetAlerts, createBudgetAlerts } from './budgetAlerts';
export { TransactionAlerts, createTransactionAlerts } from './transactionAlerts';
export { GoalCelebrations, createGoalCelebrations } from './goalCelebrations';

// Intelligence modules
export { SmartInsights, smartInsights } from './smartInsights';
export { RuleEngine, ruleEngine } from './ruleEngine';

// Types
export type {
  // Core notification types
  NotificationRule,
  NotificationCondition,
  NotificationAction,
  NotificationTemplate,
  SmartInsight,
  
  // Configuration types
  BudgetAlertConfig,
  TransactionAlertConfig,
  GoalCelebrationConfig
} from './types';