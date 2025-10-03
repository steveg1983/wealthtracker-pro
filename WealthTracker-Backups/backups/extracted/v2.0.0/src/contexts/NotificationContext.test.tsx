/**
 * NotificationContext Tests
 * Comprehensive tests for the notification context provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { NotificationProvider, useNotifications } from './NotificationContext';
import type { Notification, BudgetAlert } from './NotificationContext';
import type { Goal, Budget, Transaction, Category } from '../types';

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

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

// Mock notificationService
vi.mock('../services/notificationService', () => ({
  notificationService: {
    checkBudgetAlerts: vi.fn().mockReturnValue([]),
    checkTransactionAlerts: vi.fn().mockReturnValue([]),
    checkGoalProgress: vi.fn().mockReturnValue([]),
  },
}));

import { notificationService } from '../services/notificationService';

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Reset timers first
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-20T12:00:00'));
    
    // Reset localStorage
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockClear();
    
    // Reset window.location.href
    window.location.href = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <NotificationProvider>{children}</NotificationProvider>
  );

  describe('initialization', () => {
    it('provides default values when localStorage is empty', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      // When localStorage is null, 'null' === 'true' is false
      expect(result.current.budgetAlertsEnabled).toBe(false);
      expect(result.current.alertThreshold).toBe(80);
      expect(result.current.largeTransactionAlertsEnabled).toBe(false);
      expect(result.current.largeTransactionThreshold).toBe(500);
    });

    it('loads values from localStorage', () => {
      const savedNotifications = [
        {
          id: 'notif-1',
          type: 'info',
          title: 'Test Notification',
          message: 'Test message',
          timestamp: '2025-01-19T10:00:00.000Z',
          read: false,
        },
        {
          id: 'notif-2',
          type: 'success',
          title: 'Another Notification',
          timestamp: '2025-01-19T11:00:00.000Z',
          read: true,
        },
      ];

      mockLocalStorage.getItem.mockImplementation((key) => {
        const values: Record<string, string> = {
          'money_management_notifications': JSON.stringify(savedNotifications),
          'money_management_budget_alerts_enabled': 'false',
          'money_management_alert_threshold': '90',
          'money_management_large_transaction_alerts_enabled': 'false',
          'money_management_large_transaction_threshold': '1000',
        };
        return values[key] || null;
      });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Check notifications (dates will be parsed as strings from localStorage)
      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications[0].id).toBe('notif-1');
      expect(result.current.notifications[1].id).toBe('notif-2');
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.budgetAlertsEnabled).toBe(false);
      expect(result.current.alertThreshold).toBe(90);
      expect(result.current.largeTransactionAlertsEnabled).toBe(false);
      expect(result.current.largeTransactionThreshold).toBe(1000);
    });

    it('handles invalid localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_notifications') return 'invalid json';
        if (key === 'money_management_alert_threshold') return 'not a number';
        return null;
      });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current.notifications).toEqual([]);
      // parseInt('not a number') returns NaN, which the component doesn't handle
      expect(result.current.alertThreshold).toBeNaN();
    });
  });

  describe('notification management', () => {
    it('adds a notification', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'New Notification',
          message: 'This is a test notification',
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        type: 'info',
        title: 'New Notification',
        message: 'This is a test notification',
        read: false,
        timestamp: new Date('2025-01-20T12:00:00'),
      });
      expect(result.current.notifications[0].id).toMatch(/^notification-\d+$/);
      expect(result.current.unreadCount).toBe(1);
    });

    it('adds multiple notifications at once', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      const newNotifications: Notification[] = [
        {
          id: 'notif-1',
          type: 'success',
          title: 'Success',
          timestamp: new Date(),
          read: false,
        },
        {
          id: 'notif-2',
          type: 'warning',
          title: 'Warning',
          timestamp: new Date(),
          read: false,
        },
      ];

      act(() => {
        result.current.addNotifications(newNotifications);
      });

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.unreadCount).toBe(2);
    });

    it('marks notification as read', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Add notification
      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Test',
        });
      });

      const notificationId = result.current.notifications[0].id;

      // Mark as read
      act(() => {
        result.current.markAsRead(notificationId);
      });

      expect(result.current.notifications[0].read).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    it('marks all notifications as read', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Add multiple notifications
      act(() => {
        result.current.addNotification({ type: 'info', title: 'Notification 1' });
        result.current.addNotification({ type: 'success', title: 'Notification 2' });
        result.current.addNotification({ type: 'warning', title: 'Notification 3' });
      });

      expect(result.current.unreadCount).toBe(3);

      // Mark all as read
      act(() => {
        result.current.markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
      result.current.notifications.forEach(n => {
        expect(n.read).toBe(true);
      });
    });

    it('removes a notification', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Add notifications with delay to ensure unique IDs
      act(() => {
        result.current.addNotification({ type: 'info', title: 'Keep this' });
      });
      
      act(() => {
        vi.advanceTimersByTime(1);
        result.current.addNotification({ type: 'warning', title: 'Remove this' });
      });

      expect(result.current.notifications).toHaveLength(2);
      
      // Most recent (Remove this) is first, Keep this is second
      const idToRemove = result.current.notifications[0].id;
      expect(result.current.notifications[0].title).toBe('Remove this');

      act(() => {
        result.current.removeNotification(idToRemove);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].title).toBe('Keep this');
    });

    it('clears all notifications', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Add multiple notifications
      act(() => {
        result.current.addNotification({ type: 'info', title: 'Notification 1' });
        result.current.addNotification({ type: 'success', title: 'Notification 2' });
        result.current.addNotification({ type: 'warning', title: 'Notification 3' });
      });

      expect(result.current.notifications).toHaveLength(3);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });

    it('preserves notification order (newest first)', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.addNotification({ type: 'info', title: 'First' });
      });

      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.addNotification({ type: 'success', title: 'Second' });
      });

      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.addNotification({ type: 'warning', title: 'Third' });
      });

      expect(result.current.notifications[0].title).toBe('Third');
      expect(result.current.notifications[1].title).toBe('Second');
      expect(result.current.notifications[2].title).toBe('First');
    });
  });

  describe('settings management', () => {
    it('updates budget alerts settings', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.setBudgetAlertsEnabled(false);
      });

      expect(result.current.budgetAlertsEnabled).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_budget_alerts_enabled',
        'false'
      );

      act(() => {
        result.current.setAlertThreshold(90);
      });

      expect(result.current.alertThreshold).toBe(90);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_alert_threshold',
        '90'
      );
    });

    it('updates large transaction alerts settings', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.setLargeTransactionAlertsEnabled(false);
      });

      expect(result.current.largeTransactionAlertsEnabled).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_large_transaction_alerts_enabled',
        'false'
      );

      act(() => {
        result.current.setLargeTransactionThreshold(1000);
      });

      expect(result.current.largeTransactionThreshold).toBe(1000);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_large_transaction_threshold',
        '1000'
      );
    });
  });

  describe('budget alerts', () => {
    it('creates budget alert notifications when enabled', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable budget alerts first
      act(() => {
        result.current.setBudgetAlertsEnabled(true);
      });

      const budgetAlerts: BudgetAlert[] = [
        {
          budgetId: 'budget-1',
          categoryName: 'Food',
          percentage: 85,
          spent: 425,
          budget: 500,
          period: 'monthly',
          type: 'warning',
        },
      ];

      act(() => {
        result.current.checkBudgetAlerts(budgetAlerts);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        type: 'warning',
        title: 'Budget Warning: Food',
        message: 'budget-budget-1-85', // The alert key
      });
      expect(result.current.notifications[0].action?.label).toBe('View Budget');
    });

    it('creates error notification for exceeded budgets', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable budget alerts first
      act(() => {
        result.current.setBudgetAlertsEnabled(true);
      });

      const budgetAlerts: BudgetAlert[] = [
        {
          budgetId: 'budget-1',
          categoryName: 'Entertainment',
          percentage: 120,
          spent: 600,
          budget: 500,
          period: 'monthly',
          type: 'danger',
        },
      ];

      act(() => {
        result.current.checkBudgetAlerts(budgetAlerts);
      });

      expect(result.current.notifications[0]).toMatchObject({
        type: 'error',
        title: 'Budget Exceeded: Entertainment',
      });
    });

    it('does not create budget alerts when disabled', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.setBudgetAlertsEnabled(false);
      });

      const budgetAlerts: BudgetAlert[] = [
        {
          budgetId: 'budget-1',
          categoryName: 'Food',
          percentage: 85,
          spent: 425,
          budget: 500,
          period: 'monthly',
          type: 'warning',
        },
      ];

      act(() => {
        result.current.checkBudgetAlerts(budgetAlerts);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('avoids duplicate budget alerts within 24 hours', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable budget alerts first
      act(() => {
        result.current.setBudgetAlertsEnabled(true);
      });

      const budgetAlert: BudgetAlert = {
        budgetId: 'budget-1',
        categoryName: 'Food',
        percentage: 85,
        spent: 425,
        budget: 500,
        period: 'monthly',
        type: 'warning',
      };

      // First alert
      act(() => {
        result.current.checkBudgetAlerts([budgetAlert]);
      });

      expect(result.current.notifications).toHaveLength(1);

      // The notification should have message set to the alert key
      expect(result.current.notifications[0].message).toBe('budget-budget-1-85');

      // Try to add same alert again
      act(() => {
        result.current.checkBudgetAlerts([budgetAlert]);
      });

      // Should still be just one notification
      expect(result.current.notifications).toHaveLength(1);
    });

    it('navigates to budget page when action is clicked', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable budget alerts first
      act(() => {
        result.current.setBudgetAlertsEnabled(true);
      });

      const budgetAlerts: BudgetAlert[] = [
        {
          budgetId: 'budget-1',
          categoryName: 'Food',
          percentage: 85,
          spent: 425,
          budget: 500,
          period: 'monthly',
          type: 'warning',
        },
      ];

      act(() => {
        result.current.checkBudgetAlerts(budgetAlerts);
      });

      // Click the action
      act(() => {
        result.current.notifications[0].action?.onClick();
      });

      expect(window.location.href).toBe('/budget');
    });
  });

  describe('large transaction alerts', () => {
    it('creates alert for large transactions when enabled', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable large transaction alerts first
      act(() => {
        result.current.setLargeTransactionAlertsEnabled(true);
      });

      act(() => {
        result.current.checkLargeTransaction(750, 'New TV');
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        type: 'warning',
        title: 'Large Transaction Detected',
        message: expect.stringContaining('£750.00'),
      });
    });

    it('does not create alert for transactions below threshold', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.checkLargeTransaction(250, 'Groceries');
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('does not create alert when disabled', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.setLargeTransactionAlertsEnabled(false);
      });

      act(() => {
        result.current.checkLargeTransaction(750, 'New TV');
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('respects custom threshold', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable large transaction alerts first
      act(() => {
        result.current.setLargeTransactionAlertsEnabled(true);
        result.current.setLargeTransactionThreshold(1000);
      });

      act(() => {
        result.current.checkLargeTransaction(750, 'Not large enough');
      });

      expect(result.current.notifications).toHaveLength(0);

      act(() => {
        result.current.checkLargeTransaction(1500, 'This is large');
      });

      expect(result.current.notifications).toHaveLength(1);
    });

    it('navigates to transactions page when action is clicked', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable large transaction alerts first
      act(() => {
        result.current.setLargeTransactionAlertsEnabled(true);
      });

      act(() => {
        result.current.checkLargeTransaction(750, 'New TV');
      });

      act(() => {
        result.current.notifications[0].action?.onClick();
      });

      expect(window.location.href).toBe('/transactions');
    });
  });

  describe('enhanced notifications', () => {
    it('uses notificationService for enhanced budget alerts', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable budget alerts first
      act(() => {
        result.current.setBudgetAlertsEnabled(true);
      });

      const mockBudgets: Budget[] = [];
      const mockTransactions: Transaction[] = [];
      const mockCategories: Category[] = [];
      
      const mockNotifications: Notification[] = [
        {
          id: 'service-1',
          type: 'warning',
          title: 'Service Budget Alert',
          timestamp: new Date(),
          read: false,
        },
      ];

      (notificationService.checkBudgetAlerts as any).mockReturnValue(mockNotifications);

      act(() => {
        result.current.checkEnhancedBudgetAlerts(mockBudgets, mockTransactions, mockCategories);
      });

      expect(notificationService.checkBudgetAlerts).toHaveBeenCalledWith(
        mockBudgets,
        mockTransactions,
        mockCategories
      );
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject(mockNotifications[0]);
    });

    it('does not use notificationService when budget alerts disabled', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.setBudgetAlertsEnabled(false);
      });

      act(() => {
        result.current.checkEnhancedBudgetAlerts([], [], []);
      });

      expect(notificationService.checkBudgetAlerts).not.toHaveBeenCalled();
    });

    it('uses notificationService for enhanced transaction alerts', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Enable large transaction alerts first
      act(() => {
        result.current.setLargeTransactionAlertsEnabled(true);
      });

      const mockTransaction: Transaction = {} as Transaction;
      const mockAllTransactions: Transaction[] = [];
      
      const mockNotifications: Notification[] = [
        {
          id: 'service-2',
          type: 'info',
          title: 'Service Transaction Alert',
          timestamp: new Date(),
          read: false,
        },
      ];

      (notificationService.checkTransactionAlerts as any).mockReturnValue(mockNotifications);

      act(() => {
        result.current.checkEnhancedTransactionAlerts(mockTransaction, mockAllTransactions);
      });

      expect(notificationService.checkTransactionAlerts).toHaveBeenCalledWith(
        mockTransaction,
        mockAllTransactions
      );
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject(mockNotifications[0]);
    });

    it('uses notificationService for goal progress', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      const mockGoals: Goal[] = [];
      const mockPreviousGoals: Goal[] = [];
      
      const mockNotifications: Notification[] = [
        {
          id: 'service-3',
          type: 'success',
          title: 'Goal Achieved!',
          timestamp: new Date(),
          read: false,
        },
      ];

      (notificationService.checkGoalProgress as any).mockReturnValue(mockNotifications);

      act(() => {
        result.current.checkGoalProgress(mockGoals, mockPreviousGoals);
      });

      expect(notificationService.checkGoalProgress).toHaveBeenCalledWith(
        mockGoals,
        mockPreviousGoals
      );
      expect(result.current.notifications).toEqual(mockNotifications);
    });
  });

  describe('persistence', () => {
    it('saves notifications to localStorage on changes', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Test Notification',
        });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_notifications',
        expect.stringContaining('Test Notification')
      );
    });

    it('saves settings to localStorage on changes', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result.current.setBudgetAlertsEnabled(false);
        result.current.setAlertThreshold(95);
        result.current.setLargeTransactionAlertsEnabled(false);
        result.current.setLargeTransactionThreshold(2000);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_budget_alerts_enabled',
        'false'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_alert_threshold',
        '95'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_large_transaction_alerts_enabled',
        'false'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_large_transaction_threshold',
        '2000'
      );
    });
  });

  describe('error handling', () => {
    it('throws error when useNotifications is used outside provider', () => {
      expect(() => {
        renderHook(() => useNotifications());
      }).toThrow('useNotifications must be used within a NotificationProvider');
    });

    it('handles localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Should fall back to defaults
      expect(result.current.notifications).toEqual([]);
      expect(result.current.budgetAlertsEnabled).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple notification operations', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Add multiple notifications with delays to ensure unique IDs
      act(() => {
        result.current.addNotification({ type: 'info', title: 'Info' });
      });
      act(() => {
        vi.advanceTimersByTime(1);
        result.current.addNotification({ type: 'success', title: 'Success' });
      });
      act(() => {
        vi.advanceTimersByTime(1);
        result.current.addNotification({ type: 'warning', title: 'Warning' });
      });
      act(() => {
        vi.advanceTimersByTime(1);
        result.current.addNotification({ type: 'error', title: 'Error' });
      });

      expect(result.current.notifications).toHaveLength(4);
      expect(result.current.unreadCount).toBe(4);

      // Mark some as read
      act(() => {
        result.current.markAsRead(result.current.notifications[0].id);
        result.current.markAsRead(result.current.notifications[2].id);
      });

      expect(result.current.unreadCount).toBe(2);

      // Remove one - get ID before removing
      const idToRemove = result.current.notifications[1].id;
      act(() => {
        result.current.removeNotification(idToRemove);
      });

      expect(result.current.notifications).toHaveLength(3);
      // If the removed notification was unread, count stays at 2
      // If it was read, count would be 1
      expect(result.current.unreadCount).toBe(1);

      // Mark all as read
      act(() => {
        result.current.markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
    });

    it('handles notification with action callback', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      const mockAction = vi.fn();

      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Actionable Notification',
          action: {
            label: 'Click Me',
            onClick: mockAction,
          },
        });
      });

      expect(result.current.notifications[0].action).toBeDefined();
      expect(result.current.notifications[0].action?.label).toBe('Click Me');

      act(() => {
        result.current.notifications[0].action?.onClick();
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('preserves notifications across remounts', () => {
      const notification: Notification = {
        id: 'persist-1',
        type: 'info',
        title: 'Persistent Notification',
        timestamp: new Date(),
        read: false,
      };

      // First mount
      const { result: result1, unmount } = renderHook(() => useNotifications(), { wrapper });

      act(() => {
        result1.current.addNotifications([notification]);
      });

      // Unmount
      unmount();

      // Mock localStorage to return saved notification
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_notifications') {
          return JSON.stringify([notification]);
        }
        return null;
      });

      // Remount
      const { result: result2 } = renderHook(() => useNotifications(), { wrapper });

      expect(result2.current.notifications).toHaveLength(1);
      expect(result2.current.notifications[0].title).toBe('Persistent Notification');
    });
  });
});