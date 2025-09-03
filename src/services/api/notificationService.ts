/**
 * Notification Service for Supabase
 * Handles cloud-based notifications for multi-device sync
 */

import { supabase } from '../../lib/supabase';
import type { Notification } from '../../contexts/NotificationContext';
import { logger } from '../loggingService';

export class NotificationServiceAPI {
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
        logger.error('Error fetching notifications:', error);
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
      logger.error('Error in getNotifications:', error);
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
        logger.error('Error creating notification:', error);
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
      logger.error('Error in createNotification:', error);
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
        logger.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in markAsRead:', error);
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
        logger.error('Error marking all as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in markAllAsRead:', error);
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
        logger.error('Error deleting notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in deleteNotification:', error);
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
        logger.error('Error clearing all notifications:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in clearAll:', error);
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
        logger.error('Error cleaning up old notifications:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      logger.error('Error in cleanupOldNotifications:', error);
      return 0;
    }
  }
}
