/**
 * Notification Service for Supabase
 * Handles cloud-based notifications for multi-device sync
 */

import { supabase } from '../../lib/supabase';
import type { Notification } from '../../contexts/NotificationContext';
import { createScopedLogger } from '../../loggers/scopedLogger';

export class NotificationServiceAPI {
  private static logger = createScopedLogger('NotificationServiceAPI');
  /**
   * Get all notifications for a user
   */
  static async getNotifications(userId: string): Promise<Notification[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        this.logger.error('Error fetching notifications', error as Error);
        return [];
      }

      return (data || []).map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: new Date(n.created_at),
        read: n.is_read
      }));
    } catch (error) {
      this.logger.error('Error in getNotifications', error as Error);
      return [];
    }
  }

  /**
   * Create a new notification
   */
  static async createNotification(
    userId: string,
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ): Promise<Notification | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          is_read: false
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating notification', error as Error);
        return null;
      }

      return {
        id: data.id,
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: new Date(data.created_at),
        read: data.is_read
      };
    } catch (error) {
      this.logger.error('Error in createNotification', error as Error);
      return null;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        this.logger.error('Error marking notification as read', error as Error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error in markAsRead', error as Error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        this.logger.error('Error marking all as read', error as Error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error in markAllAsRead', error as Error);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        this.logger.error('Error deleting notification', error as Error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error in deleteNotification', error as Error);
      return false;
    }
  }

  /**
   * Clear all notifications for a user
   */
  static async clearAll(userId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Error clearing all notifications', error as Error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error in clearAll', error as Error);
      return false;
    }
  }

  /**
   * Subscribe to notification updates
   */
  static subscribeToNotifications(
    userId: string,
    onUpdate: (payload: unknown) => void
  ): () => void {
    if (!supabase) return () => {};

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        onUpdate
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  static async cleanupOldNotifications(userId: string): Promise<number> {
    if (!supabase) return 0;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select();

      if (error) {
        this.logger.error('Error cleaning up old notifications', error as Error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      this.logger.error('Error in cleanupOldNotifications', error as Error);
      return 0;
    }
  }
}
