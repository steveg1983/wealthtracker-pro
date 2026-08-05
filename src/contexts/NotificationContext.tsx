/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { notificationService, type BudgetAlertContext } from '../services/notificationService';
import type { Goal, Budget, Transaction, Category } from '../types';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  /**
   * Stable identity for "this same alert again".
   *
   * WHY: budget alerts are raised from a render effect, so the same alert is
   * offered every time the page recomputes. Without a key the only thing to
   * compare was the rendered message text — which the old dedupe checked
   * against a `budget-<id>-<pct>` string it never stored, so it never matched
   * once and every recompute appended another notification. A key that does
   * not change when the wording (or the exact percentage) does is what makes
   * repeat suppression actually work.
   *
   * Persisted with the notification, so a reload does not re-raise it either.
   */
  dedupeKey?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/** How long a dedupeKey suppresses a repeat of the same alert. */
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Hard cap on stored notifications (spam guard). */
const MAX_NOTIFICATIONS = 50;
/** How many survive a reload, and how old the oldest may be. */
const MAX_RESTORED_NOTIFICATIONS = 20;
const MAX_RESTORED_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const STORAGE_KEY = 'money_management_notifications';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNotificationType = (value: unknown): value is NotificationType =>
  typeof value === 'string' && NOTIFICATION_TYPES.some((type): boolean => type === value);

/**
 * A notification's timestamp as an instant. Declared a Date, but a restored
 * one arrives as the ISO string JSON wrote — and `string > Date` is always
 * false, which is exactly how the old 24-hour dedupe window silently matched
 * nothing. NaN for anything unreadable, so it falls outside every window.
 */
const timestampMs = (notification: Notification): number => {
  const raw: unknown = notification.timestamp;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string' || typeof raw === 'number') return new Date(raw).getTime();
  return Number.NaN;
};

/**
 * A stored notification back into a real one, or null when the record is not
 * usable. `action.onClick` is a function and cannot survive JSON, so a
 * restored action is dropped rather than rendered as a button that throws when
 * clicked.
 */
function reviveNotification(value: unknown): Notification | null {
  if (!isRecord(value)) return null;
  const { id, type, title, message, timestamp, read, dedupeKey } = value;
  if (typeof id !== 'string' || id === '') return null;
  if (!isNotificationType(type)) return null;
  if (typeof title !== 'string') return null;

  const time = typeof timestamp === 'string' || typeof timestamp === 'number'
    ? new Date(timestamp)
    : timestamp instanceof Date ? timestamp : null;
  if (time === null || !Number.isFinite(time.getTime())) return null;

  return {
    id,
    type,
    title,
    ...(typeof message === 'string' ? { message } : {}),
    timestamp: time,
    read: read === true,
    ...(typeof dedupeKey === 'string' ? { dedupeKey } : {})
  };
}

/** Has this exact alert already been raised inside the dedupe window? */
function hasRecentDuplicate(existing: Notification[], dedupeKey: string, nowMs: number): boolean {
  const oldest = nowMs - DEDUPE_WINDOW_MS;
  return existing.some((n): boolean => n.dedupeKey === dedupeKey && timestampMs(n) >= oldest);
}

/**
 * Collision-free ids. `notification-${Date.now()}` collided whenever two
 * notifications were raised inside the same millisecond — which is precisely
 * what a loop of budget alerts does — and duplicate keys break markAsRead and
 * removeNotification (they act on every colliding row).
 */
function createNotificationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `notification-${crypto.randomUUID()}`;
  }
  return `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

interface NotificationContextType {
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
  /**
   * `context` carries the same facts the Budget page uses to draw its cards —
   * split lines and the accounts held in another currency — so an alert can
   * never quote a different figure from the card it is about.
   */
  checkEnhancedBudgetAlerts: (
    budgets: Budget[],
    transactions: Transaction[],
    categories: Category[],
    context?: BudgetAlertContext
  ) => void;
  checkEnhancedTransactionAlerts: (transaction: Transaction, allTransactions: Transaction[]) => void;
  checkGoalProgress: (goals: Goal[], previousGoals?: Goal[]) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>((): Notification[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      // Keep the 20 most recent, and nothing older than a week. Every entry is
      // revived (not trusted): JSON gives back plain values, so `timestamp`
      // becomes a real Date here rather than a string masquerading as one.
      const oldestAllowed = Date.now() - MAX_RESTORED_AGE_MS;
      const restored: Notification[] = [];
      for (const entry of parsed) {
        const notification = reviveNotification(entry);
        if (notification === null) continue;
        if (notification.timestamp.getTime() <= oldestAllowed) continue;
        restored.push(notification);
        if (restored.length === MAX_RESTORED_NOTIFICATIONS) break;
      }
      return restored;
    } catch {
      return [];
    }
  });

  const [budgetAlertsEnabled, setBudgetAlertsEnabled] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_budget_alerts_enabled');
      return saved === 'true';
    } catch {
      return true;
    }
  });

  const [alertThreshold, setAlertThreshold] = useState((): number => {
    try {
      const saved = localStorage.getItem('money_management_alert_threshold');
      return saved ? parseInt(saved, 10) : 80;
    } catch {
      return 80;
    }
  });

  const [largeTransactionAlertsEnabled, setLargeTransactionAlertsEnabled] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_large_transaction_alerts_enabled');
      return saved === 'true';
    } catch {
      return true;
    }
  });

  const [largeTransactionThreshold, setLargeTransactionThreshold] = useState((): number => {
    try {
      const saved = localStorage.getItem('money_management_large_transaction_threshold');
      return saved ? parseInt(saved, 10) : 500;
    } catch {
      return 500;
    }
  });
  const { formatCurrency } = useCurrencyDecimal();

  const unreadCount = notifications.filter((n): boolean => !n.read).length;

  useEffect((): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect((): void => {
    localStorage.setItem('money_management_budget_alerts_enabled', budgetAlertsEnabled.toString());
  }, [budgetAlertsEnabled]);

  useEffect((): void => {
    localStorage.setItem('money_management_alert_threshold', alertThreshold.toString());
  }, [alertThreshold]);

  useEffect((): void => {
    localStorage.setItem('money_management_large_transaction_alerts_enabled', largeTransactionAlertsEnabled.toString());
  }, [largeTransactionAlertsEnabled]);

  useEffect((): void => {
    localStorage.setItem('money_management_large_transaction_threshold', largeTransactionThreshold.toString());
  }, [largeTransactionThreshold]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void => {
    const newNotification: Notification = {
      ...notification,
      id: createNotificationId(),
      timestamp: new Date(),
      read: false
    };

    setNotifications((prev): Notification[] => {
      // A keyed notification that is already on the board is DROPPED, and the
      // previous array is returned by identity: React bails out of a state
      // update that changes nothing, so a caller firing this from a render
      // effect cannot grow state — and therefore cannot re-trigger itself.
      if (
        newNotification.dedupeKey !== undefined &&
        hasRecentDuplicate(prev, newNotification.dedupeKey, newNotification.timestamp.getTime())
      ) {
        return prev;
      }
      return [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const addNotifications = useCallback((newNotifications: Notification[]): void => {
    if (newNotifications.length === 0) return;

    setNotifications((prev): Notification[] => {
      const nowMs = Date.now();
      const knownIds = new Set(prev.map((n): string => n.id));
      const accepted: Notification[] = [];

      for (const notification of newNotifications) {
        if (knownIds.has(notification.id)) continue;
        if (notification.dedupeKey !== undefined && (
          hasRecentDuplicate(prev, notification.dedupeKey, nowMs) ||
          accepted.some((n): boolean => n.dedupeKey === notification.dedupeKey)
        )) continue;
        knownIds.add(notification.id);
        accepted.push(notification);
      }

      if (accepted.length === 0) return prev;
      return [...accepted, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const markAsRead = useCallback((id: string): void => {
    setNotifications((prev): Notification[] => 
      prev.map((n): Notification => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback((): void => {
    setNotifications((prev): Notification[] => 
      prev.map((n): Notification => ({ ...n, read: true }))
    );
  }, []);

  const removeNotification = useCallback((id: string): void => {
    setNotifications((prev): Notification[] => prev.filter((n): boolean => n.id !== id));
  }, []);

  const clearAll = useCallback((): void => {
    setNotifications([]);
  }, []);

  /**
   * Raise the budget alerts the Budget page has just computed.
   *
   * Identity matters here as much as behaviour: the page calls this from an
   * effect whose dependencies include this very callback, so closing over
   * `notifications` (as the old duplicate check did) re-created it on every
   * notification change and re-fired the effect — which added another
   * notification, which changed it again. Suppression now happens inside the
   * state updater against a stored key, leaving this callback stable.
   */
  const checkBudgetAlerts = useCallback((budgetAlerts: BudgetAlert[]): void => {
    if (!budgetAlertsEnabled) return;

    budgetAlerts.forEach((alert): void => {
      const type = alert.type === 'danger' ? 'error' : 'warning';
      const title = alert.type === 'danger'
        ? `Budget Exceeded: ${alert.categoryName}`
        : `Budget Warning: ${alert.categoryName}`;

      const message = alert.type === 'danger'
        ? `You've spent ${alert.percentage}% of your ${alert.period} budget (${formatCurrency(alert.spent)} of ${formatCurrency(alert.budget)})`
        : `You've spent ${alert.percentage}% of your ${alert.period} budget. Consider slowing down spending in this category.`;

      addNotification({
        type,
        title,
        message,
        // The budget and the BAND it has crossed — deliberately not the exact
        // percentage, which moves with every new transaction and would raise a
        // fresh "84%… 85%… 86%" alert all day. One warning and at most one
        // exceeded notice per budget per day, which is what Money does.
        dedupeKey: `budget-${alert.budgetId}-${alert.type}`,
        action: {
          label: 'View Budget',
          onClick: (): void => {
            window.location.href = '/budget';
          }
        }
      });
    });
  }, [budgetAlertsEnabled, addNotification, formatCurrency]);

  const checkLargeTransaction = useCallback((amount: number, description: string): void => {
    if (!largeTransactionAlertsEnabled) return;
    
    if (amount >= largeTransactionThreshold) {
      addNotification({
        type: 'warning',
        title: 'Large Transaction Detected',
        message: `A large transaction of ${formatCurrency(amount)} was added: ${description}`,
        action: {
          label: 'View Transactions',
          onClick: (): void => {
            window.location.href = '/transactions';
          }
        }
      });
    }
  }, [largeTransactionAlertsEnabled, largeTransactionThreshold, addNotification, formatCurrency]);

  const checkEnhancedBudgetAlerts = useCallback((
    budgets: Budget[],
    transactions: Transaction[],
    categories: Category[],
    context: BudgetAlertContext = {}
  ): void => {
    if (!budgetAlertsEnabled) return;

    const newNotifications = notificationService.checkBudgetAlerts(budgets, transactions, categories, context);
    if (newNotifications.length > 0) {
      addNotifications(newNotifications);
    }
  }, [budgetAlertsEnabled, addNotifications]);

  const checkEnhancedTransactionAlerts = useCallback((transaction: Transaction, allTransactions: Transaction[]): void => {
    if (!largeTransactionAlertsEnabled) return;
    
    const newNotifications = notificationService.checkTransactionAlerts(transaction, allTransactions);
    if (newNotifications.length > 0) {
      addNotifications(newNotifications);
    }
  }, [largeTransactionAlertsEnabled, addNotifications]);

  const checkGoalProgress = useCallback((goals: Goal[], previousGoals?: Goal[]): void => {
    const newNotifications = notificationService.checkGoalProgress(goals, previousGoals);
    if (newNotifications.length > 0) {
      addNotifications(newNotifications);
    }
  }, [addNotifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      budgetAlertsEnabled,
      setBudgetAlertsEnabled,
      alertThreshold,
      setAlertThreshold,
      largeTransactionAlertsEnabled,
      setLargeTransactionAlertsEnabled,
      largeTransactionThreshold,
      setLargeTransactionThreshold,
      addNotification,
      addNotifications,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
      checkBudgetAlerts,
      checkLargeTransaction,
      checkEnhancedBudgetAlerts,
      checkEnhancedTransactionAlerts,
      checkGoalProgress
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
