/**
 * NotificationContext - Global notification system
 *
 * Features:
 * - Toast notifications
 * - Success, error, warning, info types
 * - Auto-dismiss functionality
 * - Queue management for multiple notifications
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 for persistent
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  // Convenience methods
  showSuccess: (title: string, message?: string) => string;
  showError: (title: string, message?: string) => string;
  showWarning: (title: string, message?: string) => string;
  showInfo: (title: string, message?: string) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps): React.JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = (): string => {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    logger.debug('Notification removed:', id);
  }, []);

  const showNotification = useCallback((notificationData: Omit<Notification, 'id'>): string => {
    const id = generateId();
    const notification: Notification = {
      id,
      duration: 5000, // Default 5 seconds
      ...notificationData
    };

    setNotifications(prev => [...prev, notification]);
    logger.debug('Notification shown:', { id, type: notification.type, title: notification.title });

    // Auto-dismiss if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    return id;
  }, [removeNotification]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    logger.debug('All notifications cleared');
  }, []);

  // Convenience methods
  const showSuccess = useCallback((title: string, message?: string): string => {
    return showNotification({
      type: 'success',
      title,
      message
    });
  }, [showNotification]);

  const showError = useCallback((title: string, message?: string): string => {
    return showNotification({
      type: 'error',
      title,
      message,
      duration: 0 // Errors persist until manually dismissed
    });
  }, [showNotification]);

  const showWarning = useCallback((title: string, message?: string): string => {
    return showNotification({
      type: 'warning',
      title,
      message,
      duration: 7000 // Slightly longer for warnings
    });
  }, [showNotification]);

  const showInfo = useCallback((title: string, message?: string): string => {
    return showNotification({
      type: 'info',
      title,
      message
    });
  }, [showNotification]);

  const contextValue: NotificationContextType = {
    notifications,
    showNotification,
    removeNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

// Notification display component
function NotificationContainer(): React.JSX.Element {
  const { notifications, removeNotification } = useNotification();

  const getTypeStyles = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  if (notifications.length === 0) {
    return <></>;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg border shadow-lg animate-slideIn ${getTypeStyles(notification.type)}`}
        >
          <div className="flex items-start">
            <span className="text-lg mr-3 flex-shrink-0">
              {getTypeIcon(notification.type)}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm mb-1">
                {notification.title}
              </h4>
              {notification.message && (
                <p className="text-sm opacity-90">
                  {notification.message}
                </p>
              )}
              {notification.action && (
                <button
                  onClick={notification.action.onClick}
                  className="text-sm font-medium underline mt-2 hover:no-underline"
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 ml-2 opacity-60 hover:opacity-100 transition-opacity duration-200"
            >
              <span className="sr-only">Close</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook to use notifications
export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

// Alias for plural naming convention
export const useNotifications = useNotification;

// Export default for convenience
export default NotificationProvider;