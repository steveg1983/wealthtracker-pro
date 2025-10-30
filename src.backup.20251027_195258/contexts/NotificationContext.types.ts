import type { Goal, Budget, Transaction, Category } from '../types';
import type { ConflictAnalysis } from '../services/conflictResolutionService';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  dedupeKey?: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface BudgetAlert {
  budgetId: string;
  categoryName: string;
  percentage: number;
  spent: number;
  budget: number;
  period: string;
  type: 'warning' | 'danger';
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  budgetAlertsEnabled: boolean;
  setBudgetAlertsEnabled: (enabled: boolean) => void;
  alertThreshold: number;
  setAlertThreshold: (threshold: number) => void;
  largeTransactionAlertsEnabled: boolean;
  setLargeTransactionAlertsEnabled: (enabled: boolean) => void;
  largeTransactionThreshold: number;
  setLargeTransactionThreshold: (threshold: number) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  addNotifications: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  checkBudgetAlerts: (budgetAlerts: BudgetAlert[]) => void;
  checkLargeTransaction: (amount: number, description: string) => void;
  checkEnhancedBudgetAlerts: (budgets: Budget[], transactions: Transaction[], categories: Category[]) => void;
  checkEnhancedTransactionAlerts: (transaction: Transaction, allTransactions: Transaction[]) => void;
  checkGoalProgress: (goals: Goal[], previousGoals?: Goal[]) => void;
}

export type ConflictSummary = {
  entity?: string | undefined;
  id?: string | undefined;
  [key: string]: unknown;
};

export type ConflictEventDetail = {
  conflict: ConflictSummary;
  analysis?: ConflictAnalysis | undefined;
  source?: 'auto-sync' | 'notification';
};
