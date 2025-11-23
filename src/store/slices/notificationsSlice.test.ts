/**
 * notificationsSlice Tests
 * Comprehensive tests for the notifications Redux slice
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import type { Notification } from './notificationsSlice';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../loggers/scopedLogger', () => ({
  createScopedLogger: vi.fn(() => mockLogger),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'test-uuid-123');
global.crypto = {
  ...global.crypto,
  randomUUID: mockUUID,
};

describe('notificationsSlice', () => {
  let store: ReturnType<typeof configureStore>;
  let notificationsReducer: any;
  let actions: any;

  const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
    id: 'notif-1',
    title: 'Test Notification',
    message: 'This is a test notification',
    type: 'info',
    timestamp: new Date('2025-01-15T10:00:00'),
    read: false,
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers(); // Reset timers first
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-20T12:00:00'));
    mockLocalStorage.getItem.mockReturnValue(null);
    mockUUID.mockReturnValue('test-uuid-123');
    
    // Import module fresh for each test
    const module = await import('./notificationsSlice');
    notificationsReducer = module.default;
    actions = {
      addNotification: module.addNotification,
      markAsRead: module.markAsRead,
      markAllAsRead: module.markAllAsRead,
      removeNotification: module.removeNotification,
      clearAllNotifications: module.clearAllNotifications,
    };
    
    // Create a fresh store for each test
    store = configureStore({
      reducer: {
        notifications: notificationsReducer,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('returns default initial state when localStorage is empty', () => {
      const state = store.getState().notifications;
      expect(state).toEqual({
        notifications: [],
        unreadCount: 0,
      });
    });

    it('loads notifications from localStorage on initialization', async () => {
      const storedNotifications = [
        createMockNotification({ id: 'notif-1', read: false }),
        createMockNotification({ id: 'notif-2', read: true }),
        createMockNotification({ id: 'notif-3', read: false }),
      ];
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedNotifications));
      
      // Re-import to get fresh initialization
      vi.resetModules();
      const { default: newNotificationsReducer } = await import('./notificationsSlice');
      
      const newStore = configureStore({
        reducer: {
          notifications: newNotificationsReducer,
        },
      });
      
      const state = newStore.getState().notifications;
      expect(state.notifications).toHaveLength(3);
      expect(state.unreadCount).toBe(2); // Two unread notifications
    });

    it('handles invalid localStorage data gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      
      // Re-import to trigger initialization with invalid data
      vi.resetModules();
      const { default: newNotificationsReducer } = await import('./notificationsSlice');
      
      const newStore = configureStore({
        reducer: {
          notifications: newNotificationsReducer,
        },
      });
      
      const state = newStore.getState().notifications;
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });

    it('handles localStorage errors gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      // Re-import to trigger initialization with error
      vi.resetModules();
      const { default: newNotificationsReducer } = await import('./notificationsSlice');
      
      const newStore = configureStore({
        reducer: {
          notifications: newNotificationsReducer,
        },
      });
      
      const state = newStore.getState().notifications;
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('addNotification', () => {
    it('adds a new notification with generated id and timestamp', () => {
      const newNotification = {
        title: 'New Message',
        message: 'You have a new message',
        type: 'info' as const,
      };

      store.dispatch(actions.addNotification(newNotification));

      const state = store.getState().notifications;
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0]).toMatchObject({
        ...newNotification,
        id: 'test-uuid-123',
        timestamp: '2025-01-20T12:00:00.000Z',
        read: false,
      });
      expect(state.unreadCount).toBe(1);
    });

    it('adds notification to beginning of array (unshift)', () => {
      // Add first notification
      store.dispatch(actions.addNotification({ 
        title: 'First', 
        type: 'info' 
      }));
      
      // Generate new UUID for second notification
      mockUUID.mockReturnValue('uuid-2');
      
      // Add second notification
      store.dispatch(actions.addNotification({ 
        title: 'Second', 
        type: 'success' 
      }));

      const state = store.getState().notifications;
      expect(state.notifications[0].title).toBe('Second');
      expect(state.notifications[1].title).toBe('First');
    });

    it('saves to localStorage without action functions', () => {
      const mockAction = vi.fn();
      
      store.dispatch(actions.addNotification({
        title: 'Action Notification',
        type: 'info',
        action: {
          label: 'Click me',
          onClick: mockAction,
        },
      }));

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData[0]).not.toHaveProperty('action');
      expect(savedData[0].title).toBe('Action Notification');
    });

    it('handles all notification types', () => {
      const types: Array<Notification['type']> = ['info', 'success', 'warning', 'error'];
      
      types.forEach((type, index) => {
        mockUUID.mockReturnValue(`uuid-${index}`);
        store.dispatch(actions.addNotification({
          title: `${type} notification`,
          type,
        }));
      });

      const state = store.getState().notifications;
      expect(state.notifications).toHaveLength(4);
      expect(state.unreadCount).toBe(4);
      
      types.forEach((type, index) => {
        expect(state.notifications[3 - index].type).toBe(type); // Reversed due to unshift
      });
    });

    it('increments unread count', () => {
      for (let i = 0; i < 5; i++) {
        mockUUID.mockReturnValue(`uuid-${i}`);
        store.dispatch(actions.addNotification({
          title: `Notification ${i}`,
          type: 'info',
        }));
      }

      const state = store.getState().notifications;
      expect(state.unreadCount).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read', () => {
      // Add notifications
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      
      // Mark as read
      store.dispatch(actions.markAsRead('test-uuid-123'));

      const state = store.getState().notifications;
      expect(state.notifications[0].read).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('decrements unread count when marking as read', () => {
      // Add multiple notifications
      for (let i = 0; i < 3; i++) {
        mockUUID.mockReturnValue(`uuid-${i}`);
        store.dispatch(actions.addNotification({ 
          title: `Notification ${i}`, 
          type: 'info' 
        }));
      }

      // Mark one as read
      store.dispatch(actions.markAsRead('uuid-1'));

      const state = store.getState().notifications;
      expect(state.unreadCount).toBe(2);
    });

    it('does nothing if notification not found', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      
      const stateBefore = store.getState().notifications;
      store.dispatch(actions.markAsRead('non-existent'));
      const stateAfter = store.getState().notifications;

      expect(stateAfter).toEqual(stateBefore);
    });

    it('does nothing if notification already read', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      store.dispatch(actions.markAsRead('test-uuid-123'));
      
      const unreadCountBefore = store.getState().notifications.unreadCount;
      
      // Try to mark as read again
      store.dispatch(actions.markAsRead('test-uuid-123'));
      
      const state = store.getState().notifications;
      expect(state.unreadCount).toBe(unreadCountBefore);
    });

    it('saves to localStorage after marking as read', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      mockLocalStorage.setItem.mockClear();
      
      store.dispatch(actions.markAsRead('test-uuid-123'));
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'notifications',
        expect.any(String)
      );
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read', () => {
      // Add multiple notifications
      for (let i = 0; i < 5; i++) {
        mockUUID.mockReturnValue(`uuid-${i}`);
        store.dispatch(actions.addNotification({ 
          title: `Notification ${i}`, 
          type: 'info' 
        }));
      }

      // Mark all as read
      store.dispatch(actions.markAllAsRead());

      const state = store.getState().notifications;
      expect(state.unreadCount).toBe(0);
      state.notifications.forEach(notification => {
        expect(notification.read).toBe(true);
      });
    });

    it('handles empty notifications array', () => {
      store.dispatch(actions.markAllAsRead());

      const state = store.getState().notifications;
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });

    it('handles mix of read and unread notifications', () => {
      // Add notifications
      for (let i = 0; i < 3; i++) {
        mockUUID.mockReturnValue(`uuid-${i}`);
        store.dispatch(actions.addNotification({ 
          title: `Notification ${i}`, 
          type: 'info' 
        }));
      }

      // Mark some as read
      store.dispatch(actions.markAsRead('uuid-0'));
      store.dispatch(actions.markAsRead('uuid-2'));

      // Mark all as read
      store.dispatch(actions.markAllAsRead());

      const state = store.getState().notifications;
      expect(state.unreadCount).toBe(0);
      expect(state.notifications.every(n => n.read)).toBe(true);
    });

    it('saves to localStorage', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      mockLocalStorage.setItem.mockClear();

      store.dispatch(actions.markAllAsRead());

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'notifications',
        expect.any(String)
      );
    });
  });

  describe('removeNotification', () => {
    it('removes a notification by id', () => {
      // Add notifications
      for (let i = 0; i < 3; i++) {
        mockUUID.mockReturnValue(`uuid-${i}`);
        store.dispatch(actions.addNotification({ 
          title: `Notification ${i}`, 
          type: 'info' 
        }));
      }

      // Remove middle notification
      store.dispatch(actions.removeNotification('uuid-1'));

      const state = store.getState().notifications;
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications.find(n => n.id === 'uuid-1')).toBeUndefined();
    });

    it('decrements unread count when removing unread notification', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      
      store.dispatch(actions.removeNotification('test-uuid-123'));

      const state = store.getState().notifications;
      expect(state.unreadCount).toBe(0);
    });

    it('does not change unread count when removing read notification', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      store.dispatch(actions.markAsRead('test-uuid-123'));
      
      const unreadCountBefore = store.getState().notifications.unreadCount;
      
      store.dispatch(actions.removeNotification('test-uuid-123'));

      const state = store.getState().notifications;
      expect(state.unreadCount).toBe(unreadCountBefore);
    });

    it('does nothing if notification not found', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      
      const stateBefore = store.getState().notifications;
      store.dispatch(actions.removeNotification('non-existent'));
      const stateAfter = store.getState().notifications;

      expect(stateAfter.notifications).toEqual(stateBefore.notifications);
    });

    it('saves to localStorage after removal', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      mockLocalStorage.setItem.mockClear();

      store.dispatch(actions.removeNotification('test-uuid-123'));

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'notifications',
        expect.any(String)
      );
    });
  });

  describe('clearAllNotifications', () => {
    it('removes all notifications', () => {
      // Add multiple notifications
      for (let i = 0; i < 5; i++) {
        mockUUID.mockReturnValue(`uuid-${i}`);
        store.dispatch(actions.addNotification({ 
          title: `Notification ${i}`, 
          type: 'info' 
        }));
      }

      // Clear all
      store.dispatch(actions.clearAllNotifications());

      const state = store.getState().notifications;
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });

    it('handles empty notifications array', () => {
      store.dispatch(actions.clearAllNotifications());

      const state = store.getState().notifications;
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });

    it('saves empty array to localStorage', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      mockLocalStorage.setItem.mockClear();

      store.dispatch(actions.clearAllNotifications());

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'notifications',
        '[]'
      );
    });
  });

  describe('localStorage persistence', () => {
    it('handles localStorage.setItem errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));

      const state = store.getState().notifications;
      expect(state.notifications).toHaveLength(1); // State still updates
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save notifications',
        expect.any(Error)
      );
    });

    it('strips action handlers when saving to localStorage', () => {
      const onClick = vi.fn();
      
      store.dispatch(actions.addNotification({
        title: 'With Action',
        type: 'info',
        action: {
          label: 'Do something',
          onClick,
        },
      }));

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData[0]).not.toHaveProperty('action');
    });

    it('preserves notification order when loading from localStorage', async () => {
      const notifications = [
        createMockNotification({ id: 'notif-1', title: 'First' }),
        createMockNotification({ id: 'notif-2', title: 'Second' }),
        createMockNotification({ id: 'notif-3', title: 'Third' }),
      ];
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(notifications));
      
      vi.resetModules();
      const { default: newNotificationsReducer } = await import('./notificationsSlice');
      
      const newStore = configureStore({
        reducer: {
          notifications: newNotificationsReducer,
        },
      });
      
      const state = newStore.getState().notifications;
      expect(state.notifications[0].title).toBe('First');
      expect(state.notifications[1].title).toBe('Second');
      expect(state.notifications[2].title).toBe('Third');
    });
  });

  describe('reducer behavior', () => {
    it('returns current state for unknown action', () => {
      const initialState = store.getState().notifications;
      
      store.dispatch({ type: 'unknown/action' });
      
      const newState = store.getState().notifications;
      expect(newState).toEqual(initialState);
    });

    it('maintains immutability', () => {
      store.dispatch(actions.addNotification({ title: 'Test', type: 'info' }));
      
      const stateBefore = store.getState().notifications;
      const notificationsBefore = stateBefore.notifications;
      
      store.dispatch(actions.markAsRead('test-uuid-123'));
      
      const stateAfter = store.getState().notifications;
      
      // References should be different
      expect(stateAfter).not.toBe(stateBefore);
      expect(stateAfter.notifications).not.toBe(notificationsBefore);
      
      // Original should be unchanged
      expect(notificationsBefore[0].read).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    it('handles rapid notification management', () => {
      // Add multiple notifications quickly
      for (let i = 0; i < 10; i++) {
        mockUUID.mockReturnValue(`uuid-${i}`);
        store.dispatch(actions.addNotification({ 
          title: `Notification ${i}`, 
          type: i % 2 === 0 ? 'info' : 'success' 
        }));
      }

      // Mark some as read
      store.dispatch(actions.markAsRead('uuid-2'));
      store.dispatch(actions.markAsRead('uuid-5'));
      store.dispatch(actions.markAsRead('uuid-7'));

      // Remove some
      store.dispatch(actions.removeNotification('uuid-1'));
      store.dispatch(actions.removeNotification('uuid-3'));

      // Add more
      mockUUID.mockReturnValue('uuid-new');
      store.dispatch(actions.addNotification({ 
        title: 'New notification', 
        type: 'warning' 
      }));

      const state = store.getState().notifications;
      expect(state.notifications).toHaveLength(9); // 10 - 2 removed + 1 new
      expect(state.unreadCount).toBe(6); // 10 - 3 read - 1 removed unread + 1 new
    });

    it('handles notification with all optional fields', () => {
      const onClick = vi.fn();
      
      store.dispatch(actions.addNotification({
        title: 'Complete Notification',
        message: 'This is a detailed message with more information',
        type: 'success',
        action: {
          label: 'View Details',
          onClick,
        },
      }));

      const state = store.getState().notifications;
      const notification = state.notifications[0];
      
      expect(notification.title).toBe('Complete Notification');
      expect(notification.message).toBe('This is a detailed message with more information');
      expect(notification.type).toBe('success');
      expect(notification.action?.label).toBe('View Details');
      expect(notification.action?.onClick).toBe(onClick);
    });

    it('handles notification lifecycle', () => {
      // Add notification
      store.dispatch(actions.addNotification({ 
        title: 'Important Update', 
        type: 'warning' 
      }));

      let state = store.getState().notifications;
      expect(state.unreadCount).toBe(1);

      // User reads it
      store.dispatch(actions.markAsRead('test-uuid-123'));
      
      state = store.getState().notifications;
      expect(state.unreadCount).toBe(0);
      expect(state.notifications[0].read).toBe(true);

      // User dismisses it
      store.dispatch(actions.removeNotification('test-uuid-123'));
      
      state = store.getState().notifications;
      expect(state.notifications).toHaveLength(0);
    });
  });
});
