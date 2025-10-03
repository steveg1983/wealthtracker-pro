// Type definitions for mobile service

import type { JsonValue } from './common';

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationData {
  transactionId?: string;
  budgetId?: string;
  billId?: string;
  amount?: number;
  category?: string;
  [key: string]: JsonValue | undefined;
}

export interface SavedOfflineTransaction {
  id: string;
  data: Record<string, unknown>;
  action: string;
  timestamp: string;
  synced: boolean;
  retry_count: number;
}

export interface SavedPushNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: NotificationData;
  actions?: NotificationAction[];
  timestamp: string;
  read: boolean;
}

export interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export interface NavigatorWithConnection {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}