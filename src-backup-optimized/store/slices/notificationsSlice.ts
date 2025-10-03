import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { lazyLogger } from '../../services/serviceFactory';

const logger = lazyLogger.getLogger('NotificationsSlice');

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  actionUrl?: string;
  actionText?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  persistent?: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  budgetAlerts: boolean;
  goalReminders: boolean;
  transactionAlerts: boolean;
  securityAlerts: boolean;
  marketUpdates: boolean;
  systemMaintenance: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings;
  loading: boolean;
  error: string | null;
  lastSyncTimestamp: string | null;
}

const defaultSettings: NotificationSettings = {
  emailNotifications: true,
  pushNotifications: false,
  budgetAlerts: true,
  goalReminders: true,
  transactionAlerts: true,
  securityAlerts: true,
  marketUpdates: false,
  systemMaintenance: true,
  weeklyReports: true,
  monthlyReports: true,
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00'
  }
};

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  settings: defaultSettings,
  loading: false,
  error: null,
  lastSyncTimestamp: null,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter(n => !n.read).length;
      state.error = null;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      // Add to beginning of array for newest first
      state.notifications.unshift(notification);

      if (!notification.read) {
        state.unreadCount += 1;
      }

      logger.info('Notification added', {
        id: notification.id,
        type: notification.type,
        title: notification.title
      });
    },
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
      state.unreadCount = 0;
    },
    dismissNotification: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.dismissed = true;
        if (!notification.read) {
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications.splice(index, 1);
      }
    },
    clearDismissedNotifications: (state) => {
      const originalLength = state.notifications.length;
      state.notifications = state.notifications.filter(n => !n.dismissed);

      // Recalculate unread count
      state.unreadCount = state.notifications.filter(n => !n.read).length;

      const removedCount = originalLength - state.notifications.length;
      if (removedCount > 0) {
        logger.info('Cleared dismissed notifications', { count: removedCount });
      }
    },
    clearExpiredNotifications: (state) => {
      const now = new Date().toISOString();
      const originalLength = state.notifications.length;

      state.notifications = state.notifications.filter(n => {
        if (!n.expiresAt) return true;
        return n.expiresAt > now;
      });

      // Recalculate unread count
      state.unreadCount = state.notifications.filter(n => !n.read).length;

      const removedCount = originalLength - state.notifications.length;
      if (removedCount > 0) {
        logger.info('Cleared expired notifications', { count: removedCount });
      }
    },
    updateNotificationSettings: (state, action: PayloadAction<Partial<NotificationSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
      logger.info('Notification settings updated', action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSyncTimestamp: (state, action: PayloadAction<string>) => {
      state.lastSyncTimestamp = action.payload;
    },
    // Bulk operations
    markMultipleAsRead: (state, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload);
      let readCount = 0;

      state.notifications.forEach(notification => {
        if (ids.has(notification.id) && !notification.read) {
          notification.read = true;
          readCount++;
        }
      });

      state.unreadCount = Math.max(0, state.unreadCount - readCount);
    },
    removeMultipleNotifications: (state, action: PayloadAction<string[]>) => {
      const idsToRemove = new Set(action.payload);
      let unreadRemoved = 0;

      state.notifications = state.notifications.filter(notification => {
        if (idsToRemove.has(notification.id)) {
          if (!notification.read) {
            unreadRemoved++;
          }
          return false;
        }
        return true;
      });

      state.unreadCount = Math.max(0, state.unreadCount - unreadRemoved);
    },
    // Filter operations
    getNotificationsByType: (state, action: PayloadAction<NotificationType>) => {
      // This doesn't modify state, used for selectors
      return state.notifications.filter(n => n.type === action.payload);
    },
    getNotificationsByCategory: (state, action: PayloadAction<string>) => {
      // This doesn't modify state, used for selectors
      return state.notifications.filter(n => n.category === action.payload);
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  removeNotification,
  clearDismissedNotifications,
  clearExpiredNotifications,
  updateNotificationSettings,
  setLoading,
  setError,
  setSyncTimestamp,
  markMultipleAsRead,
  removeMultipleNotifications,
  getNotificationsByType,
  getNotificationsByCategory,
} = notificationsSlice.actions;

export { notificationsSlice };
export default notificationsSlice.reducer;