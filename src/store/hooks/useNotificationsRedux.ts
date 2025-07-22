import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../index';
import {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  type Notification
} from '../slices/notificationsSlice';

// This hook provides the same interface as the existing NotificationContext
export function useNotificationsRedux() {
  const dispatch = useAppDispatch();
  
  // Select notifications state
  const notifications = useAppSelector(state => state.notifications.notifications);
  const unreadCount = useAppSelector(state => state.notifications.unreadCount);
  
  // Methods that match the NotificationContext interface
  const addNotificationMethod = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    dispatch(addNotification(notification));
  }, [dispatch]);
  
  const markAsReadMethod = useCallback((id: string) => {
    dispatch(markAsRead(id));
  }, [dispatch]);
  
  const markAllAsReadMethod = useCallback(() => {
    dispatch(markAllAsRead());
  }, [dispatch]);
  
  const removeNotificationMethod = useCallback((id: string) => {
    dispatch(removeNotification(id));
  }, [dispatch]);
  
  const clearAllMethod = useCallback(() => {
    dispatch(clearAllNotifications());
  }, [dispatch]);
  
  // Return the same interface as NotificationContext
  return useMemo(() => ({
    // State
    notifications,
    unreadCount,
    
    // Methods
    addNotification: addNotificationMethod,
    markAsRead: markAsReadMethod,
    markAllAsRead: markAllAsReadMethod,
    removeNotification: removeNotificationMethod,
    clearAll: clearAllMethod
  }), [
    notifications, unreadCount,
    addNotificationMethod, markAsReadMethod, 
    markAllAsReadMethod, removeNotificationMethod, clearAllMethod
  ]);
}