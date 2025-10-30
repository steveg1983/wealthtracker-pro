import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { notificationService } from '../services/notificationService';
import type { Goal, Budget, Transaction, Category } from '../types';
import type { ConflictAnalysis } from '../services/conflictResolutionService';
import { useToast } from './ToastContext';
import { analyticsEngine } from '../services/analyticsEngine';
import { NotificationContext } from './NotificationContext.context';
import type {
  NotificationContextType,
  Notification as NotificationRecord,
  BudgetAlert as BudgetAlertRecord,
  ConflictEventDetail,
  ConflictSummary,
} from './NotificationContext.types';

type StoredNotification = Omit<NotificationRecord, 'timestamp'> & { timestamp: string };

const isStoredNotification = (value: unknown): value is StoredNotification => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<StoredNotification>;

  const hasValidAction =
    record.action === undefined ||
    (typeof record.action === 'object' &&
      record.action !== null &&
      typeof record.action.label === 'string' &&
      typeof record.action.onClick === 'function');

  return (
    typeof record.id === 'string' &&
    (record.type === 'info' ||
      record.type === 'success' ||
      record.type === 'warning' ||
      record.type === 'error') &&
    typeof record.title === 'string' &&
    typeof record.timestamp === 'string' &&
    typeof record.read === 'boolean' &&
    hasValidAction &&
    (record.message === undefined || typeof record.message === 'string') &&
    (record.dedupeKey === undefined || typeof record.dedupeKey === 'string')
  );
};

const parseStoredNotifications = (raw: unknown): StoredNotification[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(isStoredNotification);
};

const CONFLICT_STORAGE_KEY = 'auto_sync_conflicts';

interface StoredConflictDetail {
  conflict: ConflictEventDetail['conflict'];
  analysis?: ConflictAnalysis;
  updatedAt: string;
}

const loadConflictStore = (): Record<string, StoredConflictDetail> => {
  try {
    const raw = localStorage.getItem(CONFLICT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, StoredConflictDetail>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const persistConflictStore = (store: Record<string, StoredConflictDetail>): void => {
  try {
    localStorage.setItem(CONFLICT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore persistence failures
  }
};

const rememberConflictDetail = (id: string | undefined, detail: ConflictEventDetail): void => {
  if (!id) {
    return;
  }

  const store = loadConflictStore();
  const entry: StoredConflictDetail = {
    conflict: detail.conflict ?? {},
    updatedAt: new Date().toISOString(),
  };

  if (detail.analysis) {
    entry.analysis = detail.analysis;
  }

  store[id] = entry;
  persistConflictStore(store);
};

const forgetConflictDetail = (id: string | undefined): void => {
  if (!id) {
    return;
  }

  const store = loadConflictStore();
  if (store[id]) {
    delete store[id];
    persistConflictStore(store);
  }
};

const resolveStoredConflictDetail = (id: string | undefined): ConflictEventDetail | null => {
  if (!id) {
    return null;
  }

  const store = loadConflictStore();
  const entry = store[id];
  if (!entry) {
    return null;
  }

  const eventDetail: ConflictEventDetail = {
    conflict: entry.conflict,
  };

  if (entry.analysis) {
    eventDetail.analysis = entry.analysis;
  }

  return eventDetail;
};

export function NotificationProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { showToast, dismissToast } = useToast();
  const conflictToastIds = useRef<Record<string, string>>({});

  const [notifications, setNotifications] = useState<NotificationRecord[]>((): NotificationRecord[] => {
    try {
      const saved = localStorage.getItem('money_management_notifications');
      const parsed = saved ? parseStoredNotifications(JSON.parse(saved)) : [];
      // Limit to 20 most recent notifications on initialization to prevent excessive notifications
      // Also clear very old notifications (older than 7 days)
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const filtered = parsed.filter((notification): boolean => {
        const timestamp = new Date(notification.timestamp).getTime();
        return Number.isFinite(timestamp) && timestamp > sevenDaysAgo;
      });
      return filtered
        .slice(0, 20)
        .map((notification): NotificationRecord => ({
          ...notification,
          timestamp: new Date(notification.timestamp),
        }));
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

  const unreadCount = notifications.filter((n): boolean => !n.read).length;

  useEffect((): void => {
    localStorage.setItem('money_management_notifications', JSON.stringify(notifications));
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

  const addNotification = useCallback((notification: Omit<NotificationRecord, 'id' | 'timestamp' | 'read'>): void => {
    const dedupeKey = notification.dedupeKey;
    const newNotification: NotificationRecord = {
      ...notification,
      id: `notification-${Date.now()}`,
      timestamp: new Date(),
      read: false,
    };

    setNotifications((prev): NotificationRecord[] => {
      const filtered = dedupeKey
        ? prev.filter(existing => existing.dedupeKey !== dedupeKey)
        : prev;

      const updated = [newNotification, ...filtered];
      return updated.slice(0, 50);
    });
  }, []);

  const addNotifications = useCallback((incoming: NotificationRecord[]): void => {
    setNotifications((prev): NotificationRecord[] => {
      if (incoming.length === 0) {
        return prev;
      }

      const dedupeKeys = new Set(incoming.map(n => n.dedupeKey).filter(Boolean) as string[]);
      const filteredPrev = dedupeKeys.size > 0
        ? prev.filter(existing => !existing.dedupeKey || !dedupeKeys.has(existing.dedupeKey))
        : prev;

      const updated = [...incoming, ...filteredPrev];
      return updated.slice(0, 50);
    });
  }, []);

  const launchConflictResolver = useCallback((conflictId: string | undefined, latestDetail?: ConflictEventDetail | null): void => {
    const stored = conflictId ? resolveStoredConflictDetail(conflictId) : null;

    const mergedConflict: ConflictSummary = {
      ...(stored?.conflict ?? {}),
      ...(latestDetail?.conflict ?? {}),
    };

    if (conflictId) {
      mergedConflict.id = conflictId;
    } else if ('id' in mergedConflict && typeof mergedConflict.id !== 'string') {
      delete (mergedConflict as Record<string, unknown>).id;
    }

    const mergedEntity = latestDetail?.conflict?.entity ?? stored?.conflict?.entity;
    if (mergedEntity) {
      mergedConflict.entity = mergedEntity;
    } else if ('entity' in mergedConflict) {
      delete mergedConflict.entity;
    }

    const nextDetail: ConflictEventDetail = {
      conflict: mergedConflict,
      source: 'notification',
    };

    if (latestDetail?.analysis || stored?.analysis) {
      nextDetail.analysis = latestDetail?.analysis ?? stored?.analysis;
    }

    window.dispatchEvent(
      new CustomEvent<ConflictEventDetail>('open-conflict-resolver', {
        detail: nextDetail,
      }),
    );
  }, []);

  const showConflictToast = useCallback(
    (conflictId: string | undefined, entity: string, detail: ConflictEventDetail): void => {
      if (conflictId) {
        const existingToastId = conflictToastIds.current[conflictId];
        if (existingToastId) {
          dismissToast(existingToastId);
          delete conflictToastIds.current[conflictId];
        }
      }

      const baseToast = {
        type: 'warning' as const,
        title: `Sync conflict detected (${entity})`,
        message: 'Some changes could not be merged automatically. Review them in the conflict resolver.',
        duration: 0,
        action: {
          label: 'View details',
          onClick: () => {
            launchConflictResolver(conflictId, detail);
          },
        } as const,
      };

      const toastId = conflictId
        ? showToast({ ...baseToast, id: `toast-conflict-${conflictId}` })
        : showToast(baseToast);

      if (conflictId) {
        conflictToastIds.current[conflictId] = toastId;
      }
    },
    [dismissToast, launchConflictResolver, showToast],
  );

  useEffect(() => {
    const handleConflictEvent = (event: Event): void => {
      const maybeDetail = (event as CustomEvent<ConflictEventDetail | null | undefined>).detail;
      if (!maybeDetail || maybeDetail.source === 'notification' || !maybeDetail.conflict) {
        return;
      }

      const detail = maybeDetail as ConflictEventDetail;

      const entityRaw = detail.conflict?.entity;
      const entity = typeof entityRaw === 'string' && entityRaw.length > 0 ? entityRaw : 'sync item';
      const conflictId = typeof detail.conflict?.id === 'string' ? detail.conflict.id : undefined;

      if (conflictId) {
        rememberConflictDetail(conflictId, detail);
      }

      showConflictToast(conflictId, entity, detail);
    };

    window.addEventListener('open-conflict-resolver', handleConflictEvent as EventListener);
    const handleConflictResolved = (event: Event): void => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (!detail?.id) {
        return;
      }

      const storedDetail = resolveStoredConflictDetail(detail.id);

      const dedupeKey = `conflict-${detail.id}`;
      setNotifications(prev => prev.filter(notification => notification.dedupeKey !== dedupeKey));
      forgetConflictDetail(detail.id);
      const toastId = conflictToastIds.current[detail.id];
      if (toastId) {
        dismissToast(toastId);
        delete conflictToastIds.current[detail.id];
      }

      analyticsEngine.track('conflict_resolved_manual', {
        conflictId: detail.id,
        entity: storedDetail?.conflict?.entity ?? 'unknown',
        resolution: (detail as { resolution?: string }).resolution ?? 'manual',
      });
    };

    window.addEventListener('conflict-resolved', handleConflictResolved as EventListener);

    return () => {
      window.removeEventListener('open-conflict-resolver', handleConflictEvent as EventListener);
      window.removeEventListener('conflict-resolved', handleConflictResolved as EventListener);
    };
  }, [addNotification, dismissToast, launchConflictResolver, showConflictToast]);

  useEffect(() => {
    const store = loadConflictStore();
    const now = Date.now();
    let mutated = false;
    Object.entries(store).forEach(([id, entry]) => {
      const updatedAt = new Date(entry.updatedAt).getTime();
      if (!Number.isFinite(updatedAt) || now - updatedAt > 7 * 24 * 60 * 60 * 1000) {
        delete store[id];
        mutated = true;
      }
    });

    if (mutated) {
      persistConflictStore(store);
    }
  }, []);

  useEffect(() => {
    const store = loadConflictStore();
    const now = Date.now();

    Object.entries(store).forEach(([id, entry]) => {
      const updatedAt = new Date(entry.updatedAt).getTime();
      if (!Number.isFinite(updatedAt) || now - updatedAt > 7 * 24 * 60 * 60 * 1000) {
        return;
      }

      const entityRaw = typeof entry.conflict?.entity === 'string' && entry.conflict.entity.length > 0
        ? entry.conflict.entity
        : 'sync item';

      const storedDetail: ConflictEventDetail = {
        conflict: {
          ...(entry.conflict ?? {}),
          id,
        },
        analysis: entry.analysis,
      };

      showConflictToast(id, entityRaw, storedDetail);
    });
  }, [showConflictToast]);

  const markAsRead = useCallback((id: string): void => {
    setNotifications((prev): NotificationRecord[] =>
      prev.map((n): NotificationRecord => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback((): void => {
    setNotifications((prev): NotificationRecord[] =>
      prev.map((n): NotificationRecord => ({ ...n, read: true })),
    );
  }, []);

  const removeNotification = useCallback((id: string): void => {
    setNotifications((prev): NotificationRecord[] => prev.filter((n): boolean => n.id !== id));
  }, []);

  const clearAll = useCallback((): void => {
    setNotifications([]);
  }, []);

  const checkBudgetAlerts = useCallback((budgetAlerts: BudgetAlertRecord[]): void => {
    if (!budgetAlertsEnabled) return;

    // Check for existing alerts to avoid duplicates
    const existingAlertIds = new Set(
      notifications
        .filter((n): boolean => n.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)) // Within last 24 hours
        .map((n): string | undefined => n.dedupeKey)
        .filter((key): key is string => typeof key === 'string')
    );

    budgetAlerts.forEach((alert): void => {
      const alertKey = `budget-${alert.budgetId}-${alert.percentage}`;
      
      if (!existingAlertIds.has(alertKey)) {
        const type = alert.type === 'danger' ? 'error' : 'warning';
        const title = alert.type === 'danger' 
          ? `Budget Exceeded: ${alert.categoryName}`
          : `Budget Warning: ${alert.categoryName}`;
        
        const message = alert.type === 'danger'
          ? `You've spent ${alert.percentage}% of your ${alert.period} budget (${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(alert.spent)} of ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(alert.budget)})`
          : `You've spent ${alert.percentage}% of your ${alert.period} budget. Consider slowing down spending in this category.`;

        addNotification({
          type,
          title,
          message,
          dedupeKey: alertKey,
          action: {
            label: 'View Budget',
            onClick: (): void => {
              window.location.href = '/budget';
            }
          }
        });
      }
    });
  }, [budgetAlertsEnabled, notifications, addNotification]);

  const checkLargeTransaction = useCallback((amount: number, description: string): void => {
    if (!largeTransactionAlertsEnabled) return;
    
    if (amount >= largeTransactionThreshold) {
      addNotification({
        type: 'warning',
        title: 'Large Transaction Detected',
        message: `A large transaction of ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)} was added: ${description}`,
        action: {
          label: 'View Transactions',
          onClick: (): void => {
            window.location.href = '/transactions';
          }
        }
      });
    }
  }, [largeTransactionAlertsEnabled, largeTransactionThreshold, addNotification]);

  const checkEnhancedBudgetAlerts = useCallback((budgets: Budget[], transactions: Transaction[], categories: Category[]): void => {
    if (!budgetAlertsEnabled) return;
    
    const newNotifications = notificationService.checkBudgetAlerts(budgets, transactions, categories);
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

  const value: NotificationContextType = {
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
    checkGoalProgress,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
