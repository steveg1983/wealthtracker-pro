/**
 * NotificationContext Tests
 * Comprehensive tests for the notification context provider
 */

import React, { useEffect, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, screen, act } from '@testing-library/react';
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';
import { NotificationProvider, useNotifications } from './NotificationContext';
import type { Notification, BudgetAlert } from './NotificationContext';
import type { Goal, Budget, Transaction, Category } from '../types';

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    displayCurrency: 'GBP',
    formatCurrency: (value: unknown) => formatCurrencyDecimal(value as number, 'GBP')
  })
}));

class TestErrorBoundary extends React.Component<{ onError: (error: Error) => void; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { onError: (error: Error) => void; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

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
import { preferences } from '../services/preferencesService';

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
      // A user who has never opened the alert settings gets both alerts ON.
      // This previously asserted `false`, because the initialiser read the
      // absent preference as `saved === 'true'` and so turned "never chosen"
      // into "switched off" — while the catch fallback right beside it
      // returned true. The default is now stated once and applies to both.
      expect(result.current.budgetAlertsEnabled).toBe(true);
      expect(result.current.alertThreshold).toBe(80);
      expect(result.current.largeTransactionAlertsEnabled).toBe(true);
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
          // A user who has been through the one-time repair, i.e. everybody
          // after their first load. Without the marker these stored `false`es
          // would be indistinguishable from the ones the old build wrote
          // unasked, and the migration would (correctly) overwrite them.
          'wt_alert_prefs_migrated_v1': 'true',
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
      // Unparseable stored threshold falls back to the default. It used to
      // become NaN, and a NaN threshold fails every `>=` comparison silently,
      // so budget alerts would simply never fire again for that browser.
      expect(result.current.alertThreshold).toBe(80);
    });
  });

  describe('one-time alert preference migration', () => {
    const MIGRATION_KEY = 'wt_alert_prefs_migrated_v1';

    /**
     * The migration WRITES and the state initialisers then READ, so these tests
     * need storage that actually remembers — the suite-wide getItem stub always
     * answers from a fixed table and would hide the write entirely.
     */
    function primeStorage(initial: Record<string, string>): Record<string, string> {
      const store = { ...initial };
      mockLocalStorage.getItem.mockImplementation((key: string) => store[key] ?? null);
      mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });
      return store;
    }

    afterEach(() => {
      mockLocalStorage.setItem.mockImplementation(() => undefined);
    });

    it('turns the alert flags back on when the marker is absent', () => {
      // Exactly what the old build left behind: it wrote "false" for both
      // toggles on first mount, without anyone touching a switch.
      const store = primeStorage({
        'money_management_budget_alerts_enabled': 'false',
        'money_management_large_transaction_alerts_enabled': 'false',
      });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current.budgetAlertsEnabled).toBe(true);
      expect(result.current.largeTransactionAlertsEnabled).toBe(true);
      expect(store['money_management_budget_alerts_enabled']).toBe('true');
      expect(store['money_management_large_transaction_alerts_enabled']).toBe('true');
      expect(store[MIGRATION_KEY]).toBe('true');
    });

    it('leaves stored values alone once the marker exists, even when off', () => {
      // Same stored `false`es, but this time they are a decision — made after
      // the repair had already run. They must survive.
      const store = primeStorage({
        'money_management_budget_alerts_enabled': 'false',
        'money_management_large_transaction_alerts_enabled': 'false',
        [MIGRATION_KEY]: 'true',
      });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current.budgetAlertsEnabled).toBe(false);
      expect(result.current.largeTransactionAlertsEnabled).toBe(false);
      expect(store['money_management_budget_alerts_enabled']).toBe('false');
      expect(store['money_management_large_transaction_alerts_enabled']).toBe('false');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        'money_management_budget_alerts_enabled',
        'true'
      );
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        'money_management_large_transaction_alerts_enabled',
        'true'
      );
    });

    it('corrects the flags on the first read, not after a re-render', () => {
      // The repair runs before the state initialisers read storage, so there is
      // no frame in which the bell is silently switched off. Asserting on the
      // FIRST rendered value rather than the settled one is what makes this a
      // test of the ordering rather than of the outcome.
      const seen: boolean[] = [];
      primeStorage({ 'money_management_budget_alerts_enabled': 'false' });

      function Probe(): null {
        const { budgetAlertsEnabled } = useNotifications();
        seen.push(budgetAlertsEnabled);
        return null;
      }

      render(
        <NotificationProvider>
          <Probe />
        </NotificationProvider>
      );

      expect(seen[0]).toBe(true);
      expect(seen).not.toContain(false);
    });

    it('does not re-run once the marker has been written', () => {
      // Two mounts of the same browser: the second must not write the flags
      // again, or a user who switched alerts off between them would be
      // overruled on their next page load.
      primeStorage({ 'money_management_budget_alerts_enabled': 'false' });

      const first = renderHook(() => useNotifications(), { wrapper });
      expect(first.result.current.budgetAlertsEnabled).toBe(true);
      first.unmount();

      // The user now deliberately switches budget alerts off. Written through
      // the preferences document, because that is where an alert preference
      // lives — it belongs to the account, so "warn me over £500" does not have
      // to be said again on the next machine. The one-time repair MARKER stays
      // in this browser's storage, since it records a fix applied here.
      preferences.setItem('money_management_budget_alerts_enabled', 'false');
      mockLocalStorage.setItem.mockClear();

      const second = renderHook(() => useNotifications(), { wrapper });
      expect(second.result.current.budgetAlertsEnabled).toBe(false);
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(MIGRATION_KEY, 'true');
    });

    it('still applies the defaults when localStorage cannot be read', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      expect(result.current.budgetAlertsEnabled).toBe(true);
      expect(result.current.largeTransactionAlertsEnabled).toBe(true);
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
      // Ids come from crypto.randomUUID (stubbed in the test setup), not from
      // `notification-${Date.now()}`: two alerts raised in the same millisecond
      // used to share an id, and markAsRead/remove then acted on both. The
      // distinctness of same-millisecond ids is asserted under
      // "budget alerts > repeat suppression".
      expect(result.current.notifications[0].id).toMatch(/^notification-\S+$/);
      expect(result.current.notifications[0].id).not.toMatch(/^notification-\d+$/);
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
      });
      // The message should contain information about the budget threshold
      expect(result.current.notifications[0].message).toContain('85%');
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

    it('creates budget alerts when called multiple times', () => {
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

      // The notification should have a message about the budget
      expect(result.current.notifications[0].message).toContain('85%');
    });

    // Regression (audit 2026-08): the old duplicate check compared each
    // notification's MESSAGE against a `budget-<id>-<pct>` key that was never
    // stored, so it matched nothing and every call appended another
    // notification. The Budget page raises these from an effect that depends on
    // checkBudgetAlerts, and checkBudgetAlerts closed over `notifications` —
    // so each added notification re-created the callback, re-ran the effect and
    // added another. With real (non-zero) budget percentages that is unbounded.
    describe('repeat suppression', () => {
      const alert: BudgetAlert = {
        budgetId: 'budget-1',
        categoryName: 'Food',
        percentage: 85,
        spent: 425,
        budget: 500,
        period: 'monthly',
        type: 'warning',
      };

      const enabled = () => {
        const { result } = renderHook(() => useNotifications(), { wrapper });
        act(() => {
          result.current.setBudgetAlertsEnabled(true);
        });
        return result;
      };

      it('raises the same budget alert once, however many times the effect fires', () => {
        const result = enabled();

        act(() => {
          result.current.checkBudgetAlerts([alert]);
        });
        const first = result.current.notifications[0];

        act(() => {
          result.current.checkBudgetAlerts([alert]);
          result.current.checkBudgetAlerts([alert]);
          result.current.checkBudgetAlerts([alert]);
        });

        expect(result.current.notifications).toHaveLength(1);
        // Same object: the state array was returned by identity, which is what
        // makes React bail out and stops the effect re-firing.
        expect(result.current.notifications[0]).toBe(first);
      });

      it('suppresses the repeat even as the percentage creeps up', () => {
        // The band is the identity, not the exact figure — otherwise every new
        // transaction ("84%… 85%… 86%") would raise a fresh notification.
        const result = enabled();

        act(() => {
          result.current.checkBudgetAlerts([alert]);
        });
        act(() => {
          vi.advanceTimersByTime(60_000);
          result.current.checkBudgetAlerts([{ ...alert, percentage: 91, spent: 455 }]);
        });

        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].message).toContain('85%');
      });

      it('still raises the exceeded alert after the warning — a different band', () => {
        const result = enabled();

        act(() => {
          result.current.checkBudgetAlerts([alert]);
        });
        act(() => {
          vi.advanceTimersByTime(60_000);
          result.current.checkBudgetAlerts([
            { ...alert, percentage: 120, spent: 600, type: 'danger' }
          ]);
        });

        expect(result.current.notifications).toHaveLength(2);
        expect(result.current.notifications[0].title).toBe('Budget Exceeded: Food');
        expect(result.current.notifications[1].title).toBe('Budget Warning: Food');
      });

      it('keeps alerts for different budgets apart', () => {
        const result = enabled();

        act(() => {
          result.current.checkBudgetAlerts([
            alert,
            { ...alert, budgetId: 'budget-2', categoryName: 'Travel' }
          ]);
          result.current.checkBudgetAlerts([
            alert,
            { ...alert, budgetId: 'budget-2', categoryName: 'Travel' }
          ]);
        });

        expect(result.current.notifications).toHaveLength(2);
      });

      it('raises it again once the suppression window has passed', () => {
        const result = enabled();

        act(() => {
          result.current.checkBudgetAlerts([alert]);
        });
        act(() => {
          vi.advanceTimersByTime(25 * 60 * 60 * 1000);
          result.current.checkBudgetAlerts([alert]);
        });

        expect(result.current.notifications).toHaveLength(2);
      });

      it('does not re-raise an alert restored from a previous session', () => {
        // The key is persisted, so a reload does not start the day with a
        // duplicate of every alert already on the board.
        const stored = [{
          id: 'notification-stored',
          type: 'warning',
          title: 'Budget Warning: Food',
          message: "You've spent 85% of your monthly budget.",
          timestamp: new Date('2025-01-20T09:00:00').toISOString(),
          read: false,
          dedupeKey: 'budget-budget-1-warning',
        }];
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'money_management_notifications') return JSON.stringify(stored);
          if (key === 'money_management_budget_alerts_enabled') return 'true';
          return null;
        });

        const { result } = renderHook(() => useNotifications(), { wrapper });

        act(() => {
          result.current.checkBudgetAlerts([alert]);
        });

        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].id).toBe('notification-stored');
      });

      it('gives every notification a distinct id inside a single millisecond', () => {
        const result = enabled();

        act(() => {
          result.current.checkBudgetAlerts([
            alert,
            { ...alert, budgetId: 'budget-2' },
            { ...alert, budgetId: 'budget-3' }
          ]);
        });

        const ids = result.current.notifications.map(n => n.id);
        expect(new Set(ids).size).toBe(3);
      });

      it('drops a restored action button rather than rendering one that throws', () => {
        // onClick is a function: JSON.stringify silently drops it, and the old
        // code kept the { label } behind, so clicking it crashed the page.
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'money_management_notifications') {
            return JSON.stringify([{
              id: 'notification-stored',
              type: 'warning',
              title: 'Budget Warning: Food',
              timestamp: new Date('2025-01-20T09:00:00').toISOString(),
              read: false,
              action: { label: 'View Budget' },
            }]);
          }
          return null;
        });

        const { result } = renderHook(() => useNotifications(), { wrapper });

        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].action).toBeUndefined();
      });

      it('settles instead of growing when an effect depends on checkBudgetAlerts (the Budget page pattern)', () => {
        // src/pages/Budget.tsx raises its alerts from an effect whose deps
        // include checkBudgetAlerts. Before the fix that callback changed
        // identity on every notification change, so: effect → notification →
        // new callback → effect → notification… React tears this down with
        // "Maximum update depth exceeded" once the percentages are real.
        mockLocalStorage.getItem.mockImplementation((key) =>
          key === 'money_management_budget_alerts_enabled' ? 'true' : null
        );

        let renderCount = 0;
        function BudgetPageLike(): React.JSX.Element {
          const { checkBudgetAlerts, notifications } = useNotifications();
          renderCount += 1;
          // A circuit breaker, because a regression here does not fail — it
          // renders until the worker runs out of memory (measured).
          if (renderCount > 25) {
            throw new Error('checkBudgetAlerts is looping: the effect never settles');
          }

          useEffect(() => {
            checkBudgetAlerts([alert]);
          }, [checkBudgetAlerts]);

          return <span data-testid="count">{notifications.length}</span>;
        }

        render(
          <NotificationProvider>
            <BudgetPageLike />
          </NotificationProvider>
        );

        expect(screen.getByTestId('count').textContent).toBe('1');
        // One render for the mount, one for the notification landing. Anything
        // unbounded shows up here long before the assertion above does.
        expect(renderCount).toBeLessThanOrEqual(4);
      });

      it('restores timestamps as real Dates, not the strings JSON wrote', () => {
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'money_management_notifications') {
            return JSON.stringify([{
              id: 'notification-stored',
              type: 'info',
              title: 'Stored',
              timestamp: new Date('2025-01-20T09:00:00').toISOString(),
              read: false,
            }]);
          }
          return null;
        });

        const { result } = renderHook(() => useNotifications(), { wrapper });

        expect(result.current.notifications[0].timestamp).toBeInstanceOf(Date);
      });
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

    it('navigates to the accounts page when action is clicked', () => {
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

      // The alert is raised from an amount and a description, with no id to
      // point at, so it offers the accounts — where the registers are. There
      // is no global list of transactions to open any more.
      expect(window.location.href).toBe('/accounts');
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

      // The fourth argument is the spending context (split lines, foreign
      // accounts); a caller that supplies none gets the empty one.
      expect(notificationService.checkBudgetAlerts).toHaveBeenCalledWith(
        mockBudgets,
        mockTransactions,
        mockCategories,
        {}
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
      // Labelled on the way in, because notificationService builds alerts from
      // generic rules and cannot say what a batch is about — but the caller
      // asking for goal progress always can. The label is what routes the
      // alert to the Goals filter in the notification bell.
      expect(result.current.notifications).toEqual(
        mockNotifications.map((notification) => ({ ...notification, category: 'goal' }))
      );
    });
  });

  // The alerts computed here are rendered by the notification bell in the
  // header, which reads the activity feed rather than this context. These
  // tests cover the announcement that joins the two.
  describe('activity feed bridge', () => {
    const captureFeed = (): { entries: Array<Record<string, unknown>>; stop: () => void } => {
      const entries: Array<Record<string, unknown>> = [];
      const listener = (event: Event): void => {
        entries.push((event as CustomEvent<Record<string, unknown>>).detail);
      };
      window.addEventListener('activity-logged', listener);
      return { entries, stop: (): void => window.removeEventListener('activity-logged', listener) };
    };

    it('announces an accepted budget alert to the bell', () => {
      const feed = captureFeed();
      try {
        const { result } = renderHook(() => useNotifications(), { wrapper });

        act(() => {
          result.current.checkBudgetAlerts([
            {
              budgetId: 'budget-1',
              categoryName: 'Groceries',
              percentage: 120,
              spent: 600,
              budget: 500,
              period: 'monthly',
              type: 'danger',
            },
          ]);
        });

        expect(feed.entries).toHaveLength(1);
        expect(feed.entries[0]).toMatchObject({
          type: 'budget',
          title: 'Budget Exceeded: Groceries',
          actionUrl: '/budget',
        });
      } finally {
        feed.stop();
      }
    });

    it('announces a suppressed repeat only once', () => {
      const feed = captureFeed();
      try {
        const { result } = renderHook(() => useNotifications(), { wrapper });

        const alert: BudgetAlert = {
          budgetId: 'budget-1',
          categoryName: 'Groceries',
          percentage: 120,
          spent: 600,
          budget: 500,
          period: 'monthly',
          type: 'danger',
        };

        // The Budget page raises its alerts from a render effect, so the same
        // alert is offered again on every recompute. The bell must hear it
        // once, not once per render.
        act(() => { result.current.checkBudgetAlerts([alert]); });
        act(() => { result.current.checkBudgetAlerts([alert]); });

        expect(feed.entries).toHaveLength(1);
      } finally {
        feed.stop();
      }
    });

    it('keeps transient acknowledgements out of the feed', () => {
      const feed = captureFeed();
      try {
        const { result } = renderHook(() => useNotifications(), { wrapper });

        // "Report Saved" and friends carry no category: they are receipts for
        // something the user just did, not alerts to work through later.
        act(() => {
          result.current.addNotification({ type: 'success', title: 'Report Saved' });
        });

        expect(result.current.notifications).toHaveLength(1);
        expect(feed.entries).toHaveLength(0);
      } finally {
        feed.stop();
      }
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
    it.skip('throws error when useNotifications is used outside provider', () => {
      const onError = vi.fn();
      const BoundaryWrapper = ({ children }: { children: ReactNode }) => (
        <TestErrorBoundary onError={onError}>{children}</TestErrorBoundary>
      );

      renderHook(() => useNotifications(), { wrapper: BoundaryWrapper });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'useNotifications must be used within a NotificationProvider',
        })
      );
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
