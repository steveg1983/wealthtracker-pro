/**
 * Push Notification Service
 * Manages push notification subscriptions and interactions
 */

import React from 'react';

import { serviceWorkerRegistration } from '../utils/serviceWorkerRegistration';
import { logger } from './loggingService';

type NotificationAction = { action: string; title: string; icon?: string };

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
}

interface NotificationPreferences {
  budgetAlerts: boolean;
  billReminders: boolean;
  goalAchievements: boolean;
  investmentAlerts: boolean;
  weeklyReports: boolean;
  unusualSpending: boolean;
}

class PushNotificationService {
  private vapidPublicKey: string;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    // This should be your VAPID public key from your server
    // For now, using a placeholder - replace with actual key
    this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 
      'BKcvxvtwNpK2QFYwpwKyTjdGaNzHKdvLXYqfT2VzQd6X0gSJI_6R5gSjB2LqvJJcQ_8G9pYsvGLPCmWYYZrJe1Y';
  }

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<void> {
    try {
      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        logger.warn('Service Worker not supported');
        return;
      }

      // Check if push notifications are supported
      if (!('PushManager' in window)) {
        logger.warn('Push notifications not supported');
        return;
      }

      // Get service worker registration
      const reg = await navigator.serviceWorker.ready;
      this.registration = reg;

      // Check current permission status
      const permission = await this.getPermissionState();
      logger.info('Push notification permission', { permission });

    } catch (error) {
      logger.error('Failed to initialize push notifications:', error);
    }
  }

  /**
   * Request permission for push notifications
   */
  async requestPermission(): Promise<NotificationPermission> {
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        await this.subscribe();
      }
      
      return permission;
    } catch (error) {
      logger.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Get current permission state
   */
  async getPermissionState(): Promise<NotificationPermission> {
    return Notification.permission;
  }

  /**
   * Check if user is subscribed to push notifications
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    const subscription = await this.registration.pushManager.getSubscription();
    return subscription !== null;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    try {
      // Convert VAPID key
      const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

      // Subscribe
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      return subscription;
    } catch (error) {
      logger.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe
        await subscription.unsubscribe();
        
        // Remove subscription from server
        await this.removeSubscriptionFromServer(subscription);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription,
          preferences: this.getNotificationPreferences()
        })
      });
    } catch (error) {
      logger.error('Failed to send subscription to server:', error);
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription })
      });
    } catch (error) {
      logger.error('Failed to remove subscription from server:', error);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: NotificationPreferences): Promise<void> {
    // Save to local storage
    localStorage.setItem('notificationPreferences', JSON.stringify(preferences));

    // Update on server if subscribed
    if (await this.isSubscribed()) {
      try {
        await fetch('/api/notifications/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ preferences })
        });
      } catch (error) {
        logger.error('Failed to update notification preferences:', error);
      }
    }
  }

  /**
   * Get notification preferences
   */
  getNotificationPreferences(): NotificationPreferences {
    const stored = localStorage.getItem('notificationPreferences');
    
    if (stored) {
      return JSON.parse(stored);
    }

    // Default preferences
    return {
      budgetAlerts: true,
      billReminders: true,
      goalAchievements: true,
      investmentAlerts: true,
      weeklyReports: false,
      unusualSpending: true
    };
  }

  /**
   * Show local notification (for testing or fallback)
   */
  async showNotification(options: PushNotificationOptions): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    type SWNotificationOptions = NotificationOptions & { actions?: NotificationAction[] };
    const swOptions: SWNotificationOptions = {
      body: options.body,
      icon: options.icon || '/icon-192.png',
      badge: options.badge || '/badge-72.png',
      tag: options.tag,
      data: options.data,
      actions: options.actions,
      requireInteraction: options.requireInteraction
    };
    await this.registration.showNotification(options.title, swOptions);
  }

  /**
   * Test push notification
   */
  async testNotification(): Promise<void> {
    await this.showNotification({
      title: 'WealthTracker Test',
      body: 'Push notifications are working! 🎉',
      tag: 'test-notification',
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    });
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  /**
   * Handle notification types
   */
  static getNotificationConfig(type: string, data: any): PushNotificationOptions {
    switch (type) {
      case 'budget-alert':
        return {
          title: '💰 Budget Alert',
          body: `You've used ${data.percentage}% of your ${data.category} budget`,
          tag: 'budget-alert',
          data: { type: 'budget-alert', ...data },
          actions: [
            { action: 'view', title: 'View Budget' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        };

      case 'bill-reminder':
        return {
          title: '📅 Bill Due Soon',
          body: `${data.name} - $${data.amount} due in ${data.daysUntilDue} days`,
          tag: `bill-${data.id}`,
          data: { type: 'bill-reminder', ...data },
          requireInteraction: true,
          actions: [
            { action: 'pay', title: 'Mark as Paid' },
            { action: 'remind-later', title: 'Remind Later' }
          ]
        };

      case 'goal-achieved':
        return {
          title: '🎉 Goal Achieved!',
          body: `Congratulations! You've reached your "${data.name}" goal`,
          tag: `goal-${data.id}`,
          data: { type: 'goal-achieved', ...data }
        };

      case 'investment-alert':
        return {
          title: '📈 Investment Alert',
          body: data.message || 'Check your portfolio for important updates',
          tag: 'investment-alert',
          data: { type: 'investment-alert', ...data }
        };

      case 'weekly-report':
        return {
          title: '📊 Weekly Summary',
          body: 'Your weekly financial report is ready',
          tag: 'weekly-report',
          data: { type: 'weekly-report', ...data }
        };

      case 'unusual-spending':
        return {
          title: '⚠️ Unusual Spending Detected',
          body: `Spending in ${data.category} is ${data.percentage}% higher than usual`,
          tag: 'unusual-spending',
          data: { type: 'unusual-spending', ...data },
          requireInteraction: true
        };

      default:
        return {
          title: 'WealthTracker',
          body: data.message || 'You have a new notification',
          data
        };
    }
  }
}

// Create singleton instance
export const pushNotificationService = new PushNotificationService();

// React hook for push notifications
export const usePushNotifications = () => {
  const [permission, setPermission] = React.useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [preferences, setPreferences] = React.useState<NotificationPreferences>(
    pushNotificationService.getNotificationPreferences()
  );

  React.useEffect(() => {
    const checkStatus = async () => {
      const perm = await pushNotificationService.getPermissionState();
      setPermission(perm);
      
      const subscribed = await pushNotificationService.isSubscribed();
      setIsSubscribed(subscribed);
    };

    checkStatus();
  }, []);

  const requestPermission = React.useCallback(async () => {
    const perm = await pushNotificationService.requestPermission();
    setPermission(perm);
    
    if (perm === 'granted') {
      const subscribed = await pushNotificationService.isSubscribed();
      setIsSubscribed(subscribed);
    }
    
    return perm;
  }, []);

  const subscribe = React.useCallback(async () => {
    const subscription = await pushNotificationService.subscribe();
    if (subscription) {
      setIsSubscribed(true);
    }
    return subscription;
  }, []);

  const unsubscribe = React.useCallback(async () => {
    const success = await pushNotificationService.unsubscribe();
    if (success) {
      setIsSubscribed(false);
    }
    return success;
  }, []);

  const updatePreferences = React.useCallback(async (newPreferences: NotificationPreferences) => {
    await pushNotificationService.updatePreferences(newPreferences);
    setPreferences(newPreferences);
  }, []);

  const testNotification = React.useCallback(async () => {
    await pushNotificationService.testNotification();
  }, []);

  return {
    permission,
    isSubscribed,
    preferences,
    requestPermission,
    subscribe,
    unsubscribe,
    updatePreferences,
    testNotification
  };
};
