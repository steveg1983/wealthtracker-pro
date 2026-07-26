import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';

/**
 * The keys these notifications used to live under — ONE flat localStorage
 * entry for whoever happened to use this browser. Signing in as a different
 * user showed the previous user's alerts: real account names, real balance
 * movements. Found live 2026-07-26, one user's "HSBC PREMIER balance updated"
 * visible inside another user's session on the same phone.
 *
 * Purged on sight rather than migrated: an unscoped entry cannot prove whose
 * it is, and for financial alerts the only safe answer to "whose data is
 * this?" being unanswerable is deletion.
 */
const LEGACY_KEYS = ['recentActivities', 'lastActivityCheck'] as const;

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

interface ActivityCounts {
  total: number;
  unread: number;
  transactions: number;
  accounts: number;
  budgets: number;
  goals: number;
  system: number;
}

export function useActivityTracking() {
  // Keyed by the signed-in user, so alerts can never survive onto someone
  // else's session on a shared device. No user (public pages, demo mode) →
  // no persistence: the feed still works, in memory only.
  const { user } = useUser();
  const keys = useMemo(
    () =>
      user
        ? {
            activities: `recentActivities:${user.id}`,
            lastCheck: `lastActivityCheck:${user.id}`,
          }
        : null,
    [user]
  );
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

  const updateCounts = useCallback((activities: ActivityItem[]) => {
    // Filter out sync and system notifications - only count app-data notifications
    const appActivities = activities.filter(a => a.type !== 'sync' && a.type !== 'system');
    const counts: ActivityCounts = {
      total: appActivities.length,
      unread: appActivities.filter(a => !a.read).length,
      transactions: appActivities.filter(a => a.type === 'transaction').length,
      accounts: appActivities.filter(a => a.type === 'account').length,
      budgets: appActivities.filter(a => a.type === 'budget').length,
      goals: appActivities.filter(a => a.type === 'goal').length,
      system: 0 // Always 0 since we're excluding system notifications
    };
    setCounts(counts);
  }, []);

  const addActivity = useCallback((activity: Omit<ActivityItem, 'id' | 'timestamp' | 'read'>) => {
    const newActivity: ActivityItem = {
      ...activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      read: false
    };

    setActivities(prev => {
      const updated = [newActivity, ...prev].slice(0, 100); // Keep last 100 activities
      if (keys) localStorage.setItem(keys.activities, JSON.stringify(updated));
      updateCounts(updated);
      return updated;
    });

    // Dispatch event for notification bell update
    window.dispatchEvent(new CustomEvent('activity-added', {
      detail: newActivity
    }));
  }, [updateCounts, keys]);

  const markAsRead = useCallback((activityId: string) => {
    setActivities(prev => {
      const updated = prev.map(a =>
        a.id === activityId ? { ...a, read: true } : a
      );
      if (keys) localStorage.setItem(keys.activities, JSON.stringify(updated));
      updateCounts(updated);
      return updated;
    });
  }, [updateCounts, keys]);

  const markAllAsRead = useCallback(() => {
    setActivities(prev => {
      const updated = prev.map(a => ({ ...a, read: true }));
      if (keys) localStorage.setItem(keys.activities, JSON.stringify(updated));
      updateCounts(updated);
      return updated;
    });

    const now = new Date();
    setLastChecked(now);
    if (keys) localStorage.setItem(keys.lastCheck, now.toISOString());
  }, [updateCounts, keys]);

  const clearActivities = useCallback(() => {
    setActivities([]);
    if (keys) localStorage.removeItem(keys.activities);
    updateCounts([]);
  }, [updateCounts, keys]);

  const checkForNewActivities = useCallback(() => {
    // In production, this would check with the backend
    // For now, we'll simulate by checking localStorage
    const stored = keys ? localStorage.getItem(keys.activities) : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      const activities = parsed.map((a: { timestamp: string | Date }) => ({
        ...a,
        timestamp: new Date(a.timestamp)
      }));
      setActivities(activities);
      updateCounts(activities);
    }
  }, [updateCounts, keys]);

  const getRecentByType = useCallback((type: ActivityItem['type'], limit = 5) => {
    return activities
      .filter(a => a.type === type)
      .slice(0, limit);
  }, [activities]);

  const getUnreadCount = useCallback((type?: ActivityItem['type']) => {
    // Exclude sync and system notifications from counts - only count app-data notifications
    const appActivities = activities.filter(a => a.type !== 'sync' && a.type !== 'system');
    if (type) {
      return appActivities.filter(a => a.type === type && !a.read).length;
    }
    return appActivities.filter(a => !a.read).length;
  }, [activities]);

  const getNewSinceLastCheck = useCallback(() => {
    return activities.filter(a => a.timestamp > lastChecked);
  }, [activities, lastChecked]);

  // Load THIS user's activities; runs again if the signed-in user changes.
  useEffect(() => {
    // The unscoped pre-fix entries can belong to anyone who ever used this
    // browser — delete them wherever found.
    for (const legacy of LEGACY_KEYS) {
      localStorage.removeItem(legacy);
    }

    const stored = keys ? localStorage.getItem(keys.activities) : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      const activities = parsed.map((a: { timestamp: string | Date }) => ({
        ...a,
        timestamp: new Date(a.timestamp)
      }));
      setActivities(activities);
      updateCounts(activities);
    } else {
      // A different user (or none) is signed in now — the previous user's
      // feed must not linger in React state either.
      setActivities([]);
      updateCounts([]);
    }

    // Load last checked time
    const lastCheckedStored = keys ? localStorage.getItem(keys.lastCheck) : null;
    if (lastCheckedStored) {
      setLastChecked(new Date(lastCheckedStored));
    }

    // Listen for activity events
    const handleActivity = (event: Event) => {
      const customEvent = event as CustomEvent<ActivityItem>;
      addActivity(customEvent.detail);
    };

    window.addEventListener('activity-logged', handleActivity);

    // Check for new activities periodically
    const interval = setInterval(checkForNewActivities, 60000); // Every minute

    return () => {
      window.removeEventListener('activity-logged', handleActivity);
      clearInterval(interval);
    };
  }, [addActivity, checkForNewActivities, updateCounts, keys]);

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

// Helper function to log activities from anywhere in the app
export function logActivity(activity: Omit<ActivityItem, 'id' | 'timestamp' | 'read'>) {
  window.dispatchEvent(new CustomEvent('activity-logged', {
    detail: activity
  }));
}
