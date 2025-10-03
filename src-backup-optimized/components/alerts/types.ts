import type { DecimalInstance } from '../../utils/decimal';

export interface AlertConfig {
  id: string;
  name: string;
  enabled: boolean;
  thresholds: {
    warning: number; // Percentage
    critical: number; // Percentage
  };
  notificationTypes: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  frequency: 'realtime' | 'daily' | 'weekly';
  categories: string[]; // Empty means all categories
  sound: boolean;
  vibrate: boolean;
}

export interface Alert {
  id: string;
  configId: string;
  budgetId: string;
  category: string;
  type: 'warning' | 'critical';
  percentage: number;
  spent: DecimalInstance;
  budget: DecimalInstance;
  remaining: DecimalInstance;
  message: string;
  timestamp: Date;
  isRead: boolean;
  isDismissed: boolean;
}

export interface AlertStats {
  totalAlerts: number;
  unreadAlerts: number;
  warningAlerts: number;
  criticalAlerts: number;
  mostAlertedCategory: string;
  averageSpendingPercentage: number;
}