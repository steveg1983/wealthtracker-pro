import type { Notification } from '../../contexts/NotificationContext';
import type { NotificationRule } from '../../services/notificationService';

export interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export type TabType = 'notifications' | 'rules' | 'settings';
export type FilterType = 'all' | 'unread' | 'success' | 'warning' | 'error';

export interface NotificationConfig {
  budgetConfig: {
    warningThreshold: number;
    dangerThreshold: number;
  };
  transactionConfig: {
    largeTransactionThreshold: number;
    duplicateDetectionEnabled: boolean;
  };
  goalConfig: {
    enableMilestoneNotifications: boolean;
    enableCompletionCelebration: boolean;
  };
}

export type { Notification, NotificationRule };