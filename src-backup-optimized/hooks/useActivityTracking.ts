/**
 * Activity Tracking Hook
 * Track user activities and interactions
 */

import { useCallback } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface Activity {
  id: string;
  type: 'navigation' | 'transaction' | 'account' | 'budget' | 'goal' | 'system';
  title: string;
  description?: string;
  category?: string;
  amount?: number;
  actionUrl?: string;
  timestamp: Date;
}

/**
 * Log user activity
 */
export function logActivity(activity: Omit<Activity, 'id' | 'timestamp'>): void {
  const logger = useLogger();
  const activityEntry: Activity = {
    ...activity,
    id: crypto.randomUUID(),
    timestamp: new Date()
  };

  // Log to console in development
  logger.debug('Activity logged:', activityEntry);

  // Store in localStorage (simplified implementation)
  try {
    const stored = localStorage.getItem('user_activities') || '[]';
    const activities = JSON.parse(stored) as Activity[];
    activities.unshift(activityEntry);

    // Keep only recent activities (last 100)
    if (activities.length > 100) {
      activities.splice(100);
    }

    localStorage.setItem('user_activities', JSON.stringify(activities));
  } catch (error) {
    logger.warn('Failed to store activity:', error);
  }
}

/**
 * Get recent activities
 */
export function getRecentActivities(limit = 20): Activity[] {
  try {
    const stored = localStorage.getItem('user_activities') || '[]';
    const activities = JSON.parse(stored) as Activity[];
    return activities.slice(0, limit);
  } catch (error) {
    logger.warn('Failed to load activities:', error);
    return [];
  }
}

/**
 * Clear activity history
 */
export function clearActivityHistory(): void {
  try {
    localStorage.removeItem('user_activities');
    logger.info('Activity history cleared');
  } catch (error) {
    logger.warn('Failed to clear activity history:', error);
  }
}

/**
 * Hook for activity tracking
 */
export function useActivityTracking() {
  const trackActivity = useCallback((activity: Omit<Activity, 'id' | 'timestamp'>) => {
    logActivity(activity);
  }, []);

  const getActivities = useCallback((limit?: number) => {
    return getRecentActivities(limit);
  }, []);

  const clearHistory = useCallback(() => {
    clearActivityHistory();
  }, []);

  return {
    trackActivity,
    getActivities,
    clearHistory
  };
}