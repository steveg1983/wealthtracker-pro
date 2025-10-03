/**
 * Notification Service Types
 * Type definitions for notification system
 */

import type { JsonValue } from '../../types/common';

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
  recurringDetectionEnabled?: boolean;
  merchantChangeAlerts?: boolean;
}

export interface GoalCelebrationConfig {
  milestonePercentages: number[]; // e.g., [25, 50, 75, 100]
  enableCompletionCelebration: boolean;
  enableMilestoneNotifications: boolean;
  enableProgressReminders: boolean;
  enableMilestones?: boolean;
  enableStreaks?: boolean;
  enableBadges?: boolean;
  enableSoundEffects?: boolean;
}

export interface SmartInsight {
  id: string;
  type: 'spending' | 'saving' | 'budget' | 'goal' | 'investment';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  data?: Record<string, unknown>;
  created: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationRule['type'];
  title: string;
  messageTemplate: string;
  icon?: string;
  priority: NotificationRule['priority'];
  variables: string[]; // e.g., ['amount', 'category', 'percentage']
}

export interface NotificationHistory {
  notificationId: string;
  ruleId: string;
  timestamp: Date;
  type: string;
  title: string;
  message: string;
  read: boolean;
  dismissed?: Date;
}

export interface NotificationMetrics {
  totalSent: number;
  totalRead: number;
  totalDismissed: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  avgReadTime: number;
}