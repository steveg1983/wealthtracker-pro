/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { notificationService, type BudgetAlertContext } from '../services/notificationService';
import type { Goal, Budget, Transaction, Category } from '../types';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { logActivity } from '../hooks/useActivityTracking';

const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const NOTIFICATION_CATEGORIES = ['transaction', 'account', 'budget', 'goal'] as const;
/**
 * What the alert is ABOUT, as opposed to how loud it is (`NotificationType`).
 *
 * Only alerts that carry a category reach the notification bell — see the
 * bridge effect below. That is deliberate: "Report Saved" and the other
 * acknowledgements raised by the reports pages are momentary receipts, not
 * things a user should have to dismiss from a feed tomorrow morning.
 */
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Where clicking the alert in the bell should take the user. */
const CATEGORY_ROUTES: Record<NotificationCategory, string> = {
  transaction: '/transactions',
  account: '/accounts',
  budget: '/budget',
  goal: '/goals'
};

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
  /** What this alert is about. Absent for transient acknowledgements. */
  category?: NotificationCategory;
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

/**
 * What a user who has never opened the alert settings gets.
 *
 * Stated once, here, because the old code stated it twice and disagreed with
 * itself: the initialiser did `saved === 'true'`, which turns "no stored
 * preference" into OFF, while the catch fallback returned `true`. So the
 * intended default only applied when localStorage threw. Reading a stored
 * preference and choosing a default when there ISN'T one are two different
 * questions, and `readStoredFlag` now asks them separately.
 */
const DEFAULT_BUDGET_ALERTS_ENABLED = true;
const DEFAULT_ALERT_THRESHOLD = 80;
const DEFAULT_LARGE_TRANSACTION_ALERTS_ENABLED = true;
const DEFAULT_LARGE_TRANSACTION_THRESHOLD = 500;

const BUDGET_ALERTS_ENABLED_KEY = 'money_management_budget_alerts_enabled';
const LARGE_TRANSACTION_ALERTS_ENABLED_KEY = 'money_management_large_transaction_alerts_enabled';

/** Proof that the one-time repair below has already been offered to this browser. */
const ALERT_PREFS_MIGRATION_KEY = 'wt_alert_prefs_migrated_v1';

/**
 * Undo the stored "false" that nobody chose — exactly once, ever.
 *
 * Correcting the default above only helps people who have never run the app.
 * The old build did not merely DEFAULT these two toggles to off: it read an
 * absent preference as `saved === 'true'` (i.e. false), and the persistence
 * effect beside it then WROTE that false straight back to localStorage on first
 * mount. So every browser that has ever opened WealthTracker is carrying an
 * explicit `"false"` for both alert toggles that its user never picked, and a
 * corrected default will never be consulted again.
 *
 * WHY A MARKER KEY: the stored value cannot tell the two cases apart. "The bug
 * wrote this" and "the user switched alerts off" both look exactly like
 * `"false"` — there is no third piece of evidence in the value itself. So the
 * decision is made on a different fact entirely: has this repair already run in
 * this browser? The marker records that, and nothing else. First run after this
 * ships, both flags go back to their intended defaults and the marker is
 * written; every run afterwards returns on the first line. A user who turns
 * alerts off tomorrow keeps that choice for good, because by then the marker is
 * there and this function no longer touches their preferences.
 *
 * Called from render, BEFORE the useState initialisers below read storage, so
 * the very first read already sees the corrected values and no wrong state is
 * ever shown. Safe to call repeatedly — the marker in storage, not a
 * module-level flag, is what makes it once-only, which also means it behaves
 * identically on a fresh page load and on a StrictMode double-render.
 */
function migrateAlertPreferencesOnce(): void {
  try {
    if (localStorage.getItem(ALERT_PREFS_MIGRATION_KEY) !== null) return;
    localStorage.setItem(BUDGET_ALERTS_ENABLED_KEY, String(DEFAULT_BUDGET_ALERTS_ENABLED));
    localStorage.setItem(
      LARGE_TRANSACTION_ALERTS_ENABLED_KEY,
      String(DEFAULT_LARGE_TRANSACTION_ALERTS_ENABLED)
    );
    localStorage.setItem(ALERT_PREFS_MIGRATION_KEY, 'true');
  } catch {
    // A browser that refuses localStorage has no wrongly-stored `false` to
    // repair either — readStoredFlag falls back to the same defaults.
  }
}

/** A stored on/off preference, or `fallback` when none has been saved. */
function readStoredFlag(key: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    return saved === 'true';
  } catch {
    return fallback;
  }
}

/** A stored numeric preference, or `fallback` when none has been saved. */
function readStoredNumber(key: string, fallback: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    const parsed = parseInt(saved, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNotificationType = (value: unknown): value is NotificationType =>
  typeof value === 'string' && NOTIFICATION_TYPES.some((type): boolean => type === value);

const isNotificationCategory = (value: unknown): value is NotificationCategory =>
  typeof value === 'string' && NOTIFICATION_CATEGORIES.some((category): boolean => category === value);

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
  const { id, type, title, message, timestamp, read, dedupeKey, category } = value;
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
    ...(typeof dedupeKey === 'string' ? { dedupeKey } : {}),
    ...(isNotificationCategory(category) ? { category } : {})
  };
}

/**
 * Label a batch from notificationService with what it is about.
 *
 * The service builds its alerts from generic rules and so cannot say whether
 * a given batch is budgets, transactions or goals — but the caller asking for
 * them always knows, which is why the label is applied here rather than
 * guessed from an id prefix later.
 */
function withCategory(notifications: Notification[], category: NotificationCategory): Notification[] {
  return notifications.map((notification): Notification => ({ ...notification, category }));
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
  // Deliberately above the first useState: the initialisers read localStorage,
  // and the repair has to have happened by then or the user sees one render of
  // the state the old bug left behind.
  migrateAlertPreferencesOnce();

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

  const [budgetAlertsEnabled, setBudgetAlertsEnabled] = useState((): boolean =>
    readStoredFlag(BUDGET_ALERTS_ENABLED_KEY, DEFAULT_BUDGET_ALERTS_ENABLED)
  );

  const [alertThreshold, setAlertThreshold] = useState((): number =>
    readStoredNumber('money_management_alert_threshold', DEFAULT_ALERT_THRESHOLD)
  );

  const [largeTransactionAlertsEnabled, setLargeTransactionAlertsEnabled] = useState((): boolean =>
    readStoredFlag(
      LARGE_TRANSACTION_ALERTS_ENABLED_KEY,
      DEFAULT_LARGE_TRANSACTION_ALERTS_ENABLED
    )
  );

  const [largeTransactionThreshold, setLargeTransactionThreshold] = useState((): number =>
    readStoredNumber('money_management_large_transaction_threshold', DEFAULT_LARGE_TRANSACTION_THRESHOLD)
  );
  const { formatCurrency } = useCurrencyDecimal();

  const unreadCount = notifications.filter((n): boolean => !n.read).length;

  useEffect((): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  /**
   * The bridge from the alerts computed here to the notification bell the app
   * actually mounts.
   *
   * These alerts were correct, deduped and persisted into state that nothing
   * rendered: the two components written to display them have no importers,
   * while the header's bell reads the separate activity feed. Rather than swap
   * the header over — which would trade one invisible feed for another and
   * lose the activity entries users see today — accepted alerts are announced
   * into that same feed.
   *
   * WHY from an effect rather than from inside addNotification: whether an
   * alert is accepted is decided inside a `setNotifications` updater, and
   * React re-runs updaters under StrictMode (which this app enables). Firing a
   * browser event from there would post every alert to the feed twice in
   * development. Watching the committed list instead asks the only question
   * that matters — what actually landed — exactly once per alert, and covers
   * addNotification and addNotifications with one piece of code.
   *
   * The first run only takes a census: alerts restored from a previous session
   * are already old news and must not re-announce themselves on every reload.
   */
  const bridgedNotificationIds = useRef<Set<string> | null>(null);
  useEffect((): void => {
    if (bridgedNotificationIds.current === null) {
      bridgedNotificationIds.current = new Set(notifications.map((n): string => n.id));
      return;
    }

    for (const notification of notifications) {
      if (bridgedNotificationIds.current.has(notification.id)) continue;
      bridgedNotificationIds.current.add(notification.id);
      if (notification.category === undefined) continue;

      logActivity({
        type: notification.category,
        title: notification.title,
        description: notification.message ?? '',
        actionUrl: CATEGORY_ROUTES[notification.category]
        // Deliberately no `amount`: the bell renders a bare amount green when
        // positive and red when negative, which would paint a large EXPENSE
        // green (the threshold check passes it a magnitude). The figure is
        // already in the message, formatted the way the rest of the app
        // writes money.
      });
    }
  }, [notifications]);

  useEffect((): void => {
    localStorage.setItem(BUDGET_ALERTS_ENABLED_KEY, budgetAlertsEnabled.toString());
  }, [budgetAlertsEnabled]);

  useEffect((): void => {
    localStorage.setItem('money_management_alert_threshold', alertThreshold.toString());
  }, [alertThreshold]);

  useEffect((): void => {
    localStorage.setItem(LARGE_TRANSACTION_ALERTS_ENABLED_KEY, largeTransactionAlertsEnabled.toString());
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
        category: 'budget',
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
        category: 'transaction',
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
      addNotifications(withCategory(newNotifications, 'budget'));
    }
  }, [budgetAlertsEnabled, addNotifications]);

  const checkEnhancedTransactionAlerts = useCallback((transaction: Transaction, allTransactions: Transaction[]): void => {
    if (!largeTransactionAlertsEnabled) return;
    
    const newNotifications = notificationService.checkTransactionAlerts(transaction, allTransactions);
    if (newNotifications.length > 0) {
      addNotifications(withCategory(newNotifications, 'transaction'));
    }
  }, [largeTransactionAlertsEnabled, addNotifications]);

  const checkGoalProgress = useCallback((goals: Goal[], previousGoals?: Goal[]): void => {
    const newNotifications = notificationService.checkGoalProgress(goals, previousGoals);
    if (newNotifications.length > 0) {
      addNotifications(withCategory(newNotifications, 'goal'));
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
