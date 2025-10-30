/**
 * Notification Service for Supabase
 * Handles cloud-based notifications for multi-device sync
 */

import { supabase } from '@wealthtracker/core';
import type { Notification } from '../../contexts/NotificationContext';
import { logger } from '../loggingService';
import type { Database } from '@app-types/supabase';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

const NOTIFICATION_TYPES = ['info', 'warning', 'error', 'success'] as const;
type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const toNotificationType = (value: unknown): NotificationType => {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value as NotificationType)
    ? (value as NotificationType)
    : 'info';
};

const toOptionalTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toDateOrNow = (value: string | null | undefined): Date => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

const mapRowToNotification = (row: NotificationRow): Notification => {
  const type = toNotificationType(row.type);
  const title = toOptionalTrimmedString(row.title) ?? 'Notification';
  const timestamp = toDateOrNow(row.created_at);
  const notification: Notification = {
    id: row.id,
    type,
    title,
    timestamp,
    read: Boolean(row.is_read)
  };

  const message = toOptionalTrimmedString(row.message);
  if (message !== undefined) {
    notification.message = message;
  }

  return notification;
};

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

      return (data || []).map(mapRowToNotification);
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
      const type = toNotificationType(notification.type);
      const title = toOptionalTrimmedString(notification.title) ?? 'Notification';
      const message = toOptionalTrimmedString(notification.message);

      const insertPayload: NotificationInsert = {
        user_id: userId,
        type,
        title,
        message: message ?? null,
        is_read: false
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        logger.error('Error creating notification:', error);
        return null;
      }

      return mapRowToNotification(data);
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
