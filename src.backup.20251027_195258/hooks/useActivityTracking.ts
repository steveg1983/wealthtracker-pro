import { useState, useEffect, useCallback } from 'react';

export interface ActivityItem {
  id: string;
  type: 'transaction' | 'account' | 'budget' | 'goal' | 'sync' | 'system';
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  icon?: string;
  actionUrl?: string;
  category?: string;
  amount?: number;
}

export type ActivityPayload = Omit<ActivityItem, 'id' | 'timestamp' | 'read'>;

interface ActivityCounts {
  total: number;
  unread: number;
  transactions: number;
  accounts: number;
  budgets: number;
  goals: number;
  system: number;
}

type StoredActivity = Omit<ActivityItem, 'timestamp'> & { timestamp: string };

const ACTIVITY_STORAGE_KEY = 'recentActivities';
const LAST_CHECKED_STORAGE_KEY = 'lastActivityCheck';
const ACTIVITY_LOGGED_EVENT = 'activity-logged';
const ACTIVITY_ADDED_EVENT = 'activity-added';
const ACTIVITY_CHECK_INTERVAL_MS = 60_000;

const activityTypes: ActivityItem['type'][] = ['transaction', 'account', 'budget', 'goal', 'sync', 'system'];

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

const isOptionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || typeof value === 'number';

const isActivityType = (value: unknown): value is ActivityItem['type'] =>
  typeof value === 'string' && activityTypes.includes(value as ActivityItem['type']);

const isStoredActivity = (value: unknown): value is StoredActivity => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const timestampValue = candidate.timestamp;

  return typeof candidate.id === 'string' &&
    isActivityType(candidate.type) &&
    typeof candidate.title === 'string' &&
    typeof candidate.description === 'string' &&
    typeof timestampValue === 'string' &&
    typeof candidate.read === 'boolean' &&
    isOptionalString(candidate.icon) &&
    isOptionalString(candidate.actionUrl) &&
    isOptionalString(candidate.category) &&
    isOptionalNumber(candidate.amount);
};

const isActivityPayload = (value: unknown): value is ActivityPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return isActivityType(candidate.type) &&
    typeof candidate.title === 'string' &&
    typeof candidate.description === 'string' &&
    isOptionalString(candidate.icon) &&
    isOptionalString(candidate.actionUrl) &&
    isOptionalString(candidate.category) &&
    isOptionalNumber(candidate.amount);
};

const reviveStoredActivities = (raw: unknown): ActivityItem[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.reduce<ActivityItem[]>((acc, item) => {
    if (!isStoredActivity(item)) {
      return acc;
    }

    const timestamp = new Date(item.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      return acc;
    }

    acc.push({
      ...item,
      timestamp,
    });
    return acc;
  }, []);
};

const readStoredActivities = (stored: string | null): ActivityItem[] => {
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return reviveStoredActivities(parsed);
  } catch {
    return [];
  }
};

const isActivityLoggedEvent = (event: Event): event is CustomEvent<ActivityPayload> =>
  event instanceof CustomEvent && isActivityPayload(event.detail);

export function useActivityTracking() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [counts, setCounts] = useState<ActivityCounts>({
    total: 0,
    unread: 0,
    transactions: 0,
    accounts: 0,
    budgets: 0,
    goals: 0,
    system: 0
  });
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const updateCounts = useCallback((nextActivities: ActivityItem[]) => {
    const appActivities = nextActivities.filter(activity => activity.type !== 'sync' && activity.type !== 'system');
    setCounts({
      total: appActivities.length,
      unread: appActivities.filter(activity => !activity.read).length,
      transactions: appActivities.filter(activity => activity.type === 'transaction').length,
      accounts: appActivities.filter(activity => activity.type === 'account').length,
      budgets: appActivities.filter(activity => activity.type === 'budget').length,
      goals: appActivities.filter(activity => activity.type === 'goal').length,
      system: 0,
    });
  }, []);

  const persistActivities = useCallback((nextActivities: ActivityItem[]) => {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(nextActivities));
    updateCounts(nextActivities);
  }, [updateCounts]);

  const addActivity = useCallback((activity: ActivityPayload) => {
    const newActivity: ActivityItem = {
      ...activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date(),
      read: false
    };

    setActivities(prev => {
      const updated = [newActivity, ...prev].slice(0, 100);
      persistActivities(updated);
      return updated;
    });

    window.dispatchEvent(new CustomEvent<ActivityItem>(ACTIVITY_ADDED_EVENT, {
      detail: newActivity,
    }));
  }, [persistActivities]);

  const markAsRead = useCallback((activityId: string) => {
    setActivities(prev => {
      const updated = prev.map(activity => (
        activity.id === activityId ? { ...activity, read: true } : activity
      ));
      persistActivities(updated);
      return updated;
    });
  }, [persistActivities]);

  const markAllAsRead = useCallback(() => {
    setActivities(prev => {
      const updated = prev.map(activity => ({ ...activity, read: true }));
      persistActivities(updated);
      return updated;
    });

    const now = new Date();
    setLastChecked(now);
    localStorage.setItem(LAST_CHECKED_STORAGE_KEY, now.toISOString());
  }, [persistActivities]);

  const clearActivities = useCallback(() => {
    setActivities([]);
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    updateCounts([]);
  }, [updateCounts]);

  const checkForNewActivities = useCallback(() => {
    const revived = readStoredActivities(localStorage.getItem(ACTIVITY_STORAGE_KEY));
    setActivities(revived);
    updateCounts(revived);
  }, [updateCounts]);

  useEffect(() => {
    const revived = readStoredActivities(localStorage.getItem(ACTIVITY_STORAGE_KEY));
    if (revived.length > 0) {
      setActivities(revived);
      updateCounts(revived);
    }

    const storedLastChecked = localStorage.getItem(LAST_CHECKED_STORAGE_KEY);
    if (storedLastChecked) {
      const parsed = new Date(storedLastChecked);
      if (!Number.isNaN(parsed.getTime())) {
        setLastChecked(parsed);
      }
    }

    const handleActivity: EventListener = event => {
      if (isActivityLoggedEvent(event)) {
        addActivity(event.detail);
      }
    };

    window.addEventListener(ACTIVITY_LOGGED_EVENT, handleActivity);

    const intervalId = window.setInterval(checkForNewActivities, ACTIVITY_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener(ACTIVITY_LOGGED_EVENT, handleActivity);
      window.clearInterval(intervalId);
    };
  }, [addActivity, checkForNewActivities, updateCounts]);

  const getRecentByType = useCallback((type: ActivityItem['type'], limit = 5) => {
    return activities
      .filter(activity => activity.type === type)
      .slice(0, limit);
  }, [activities]);

  const getUnreadCount = useCallback((type?: ActivityItem['type']) => {
    const appActivities = activities.filter(activity => activity.type !== 'sync' && activity.type !== 'system');
    if (type) {
      return appActivities.filter(activity => activity.type === type && !activity.read).length;
    }
    return appActivities.filter(activity => !activity.read).length;
  }, [activities]);

  const getNewSinceLastCheck = useCallback(() => {
    return activities.filter(activity => activity.timestamp > lastChecked);
  }, [activities, lastChecked]);

  return {
    activities,
    counts,
    lastChecked,
    addActivity,
    markAsRead,
    markAllAsRead,
    clearActivities,
    getRecentByType,
    getUnreadCount,
    getNewSinceLastCheck
  };
}

export function logActivity(activity: ActivityPayload) {
  window.dispatchEvent(new CustomEvent<ActivityPayload>(ACTIVITY_LOGGED_EVENT, {
    detail: activity,
  }));
}
