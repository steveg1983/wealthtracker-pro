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

  // Load activities from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('recentActivities');
    if (stored) {
      const parsed = JSON.parse(stored);
      const activities = parsed.map((a: any) => ({
        ...a,
        timestamp: new Date(a.timestamp)
      }));
      setActivities(activities);
      updateCounts(activities);
    }

    // Load last checked time
    const lastCheckedStored = localStorage.getItem('lastActivityCheck');
    if (lastCheckedStored) {
      setLastChecked(new Date(lastCheckedStored));
    }

    // Listen for activity events
    const handleActivity = (event: CustomEvent<ActivityItem>) => {
      addActivity(event.detail);
    };

    window.addEventListener('activity-logged' as any, handleActivity);
    
    // Check for new activities periodically
    const interval = setInterval(checkForNewActivities, 60000); // Every minute

    return () => {
      window.removeEventListener('activity-logged' as any, handleActivity);
      clearInterval(interval);
    };
  }, []);

  const addActivity = useCallback((activity: Omit<ActivityItem, 'id' | 'timestamp' | 'read'>) => {
    const newActivity: ActivityItem = {
      ...activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    };

    setActivities(prev => {
      const updated = [newActivity, ...prev].slice(0, 100); // Keep last 100 activities
      localStorage.setItem('recentActivities', JSON.stringify(updated));
      updateCounts(updated);
      return updated;
    });

    // Dispatch event for notification bell update
    window.dispatchEvent(new CustomEvent('activity-added', {
      detail: newActivity
    }));
  }, []);

  const updateCounts = (activities: ActivityItem[]) => {
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
  };

  const markAsRead = useCallback((activityId: string) => {
    setActivities(prev => {
      const updated = prev.map(a => 
        a.id === activityId ? { ...a, read: true } : a
      );
      localStorage.setItem('recentActivities', JSON.stringify(updated));
      updateCounts(updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setActivities(prev => {
      const updated = prev.map(a => ({ ...a, read: true }));
      localStorage.setItem('recentActivities', JSON.stringify(updated));
      updateCounts(updated);
      return updated;
    });
    
    const now = new Date();
    setLastChecked(now);
    localStorage.setItem('lastActivityCheck', now.toISOString());
  }, []);

  const clearActivities = useCallback(() => {
    setActivities([]);
    localStorage.removeItem('recentActivities');
    updateCounts([]);
  }, []);

  const checkForNewActivities = useCallback(() => {
    // In production, this would check with the backend
    // For now, we'll simulate by checking localStorage
    const stored = localStorage.getItem('recentActivities');
    if (stored) {
      const parsed = JSON.parse(stored);
      const activities = parsed.map((a: any) => ({
        ...a,
        timestamp: new Date(a.timestamp)
      }));
      setActivities(activities);
      updateCounts(activities);
    }
  }, []);

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