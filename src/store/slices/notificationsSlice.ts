import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getCurrentISOString } from '../../utils/dateHelpers';

export interface Notification {
  id: string;
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string; // Changed from Date to string for serialization
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
}

const loadNotificationsFromStorage = (): Notification[] => {
  try {
    const stored = localStorage.getItem('notifications');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveNotificationsToStorage = (notifications: Notification[]) => {
  try {
    // Don't save action functions to localStorage
    const toSave = notifications.map(({ action, ...rest }) => rest);
    localStorage.setItem('notifications', JSON.stringify(toSave));
  } catch (error) {
    console.error('Failed to save notifications:', error);
  }
};

const initialNotifications = loadNotificationsFromStorage();

const initialState: NotificationsState = {
  notifications: initialNotifications,
  unreadCount: initialNotifications.filter(n => !n.read).length,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const newNotification: Notification = {
        ...action.payload,
        id: crypto.randomUUID(),
        timestamp: getCurrentISOString() as any,
        read: false,
      };
      state.notifications.unshift(newNotification);
      state.unreadCount += 1;
      saveNotificationsToStorage(state.notifications);
    },
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount -= 1;
        saveNotificationsToStorage(state.notifications);
      }
    },
    markAllAsRead: (state) => {
      state.notifications.forEach(n => {
        n.read = true;
      });
      state.unreadCount = 0;
      saveNotificationsToStorage(state.notifications);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount -= 1;
        }
        state.notifications.splice(index, 1);
        saveNotificationsToStorage(state.notifications);
      }
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      saveNotificationsToStorage(state.notifications);
    },
  },
});

export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;