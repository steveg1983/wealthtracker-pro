import React, { useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '../../contexts/NotificationContext';
import { useLogger } from '../services/ServiceProvider';

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

export const NotificationPanel = memo(function NotificationPanel({ notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onClose
 }: NotificationPanelProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('NotificationPanel component initialized', {
        notificationCount: notifications.length,
        unreadCount,
        componentName: 'NotificationPanel'
      });
    } catch (error) {
      logger.error('NotificationPanel initialization failed:', error, 'NotificationPanel');
    }
  }, [notifications.length, unreadCount]);

  try {
    return (
      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(() => {
                    try {
                      return `${unreadCount} unread`;
                    } catch (error) {
                      logger.error('Failed to format unread count:', error, 'NotificationPanel');
                      return '! unread';
                    }
                  })()}
                </span>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => {
                    try {
                      logger.debug('Mark all as read clicked', { componentName: 'NotificationPanel' });
                      onMarkAllAsRead();
                    } catch (error) {
                      logger.error('Failed to mark all as read:', error, 'NotificationPanel');
                    }
                  }}
                  className="text-xs text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>
        </div>
      
        <div className="max-h-96 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.slice(0, 10).map((notification) => {
              try {
                return (
                  <div 
                    key={notification.id || Math.random()}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-gray-900/10' : ''
                    }`}
                    onClick={() => {
                      try {
                        logger.debug('Notification clicked', { 
                          notificationId: notification.id,
                          hasAction: Boolean(notification.action),
                          componentName: 'NotificationPanel' 
                        });
                        if (!notification.read) {
                          onMarkAsRead(notification.id);
                        }
                        if (notification.action) {
                          notification.action.onClick();
                          onClose();
                        }
                      } catch (error) {
                        logger.error('Failed to handle notification click:', error, 'NotificationPanel');
                      }
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          notification.type === 'success' ? 'bg-green-500' :
                          notification.type === 'warning' ? 'bg-yellow-500' :
                          notification.type === 'error' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}></div>
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${!notification.read ? 'font-semibold' : ''} text-gray-900 dark:text-white`}>
                          {notification.title || 'Notification'}
                        </p>
                        {notification.message && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {(() => {
                            try {
                              return formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true });
                            } catch (error) {
                              logger.error('Failed to format notification timestamp:', error, 'NotificationPanel');
                              return 'Recently';
                            }
                          })()}
                        </p>
                        {notification.action && (
                          <button className="text-xs text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 mt-2 font-medium">
                            {notification.action.label || 'Action'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              } catch (error) {
                logger.error('Failed to render notification: ' + (notification?.id || 'unknown'), error, 'NotificationPanel');
                return (
                  <div 
                    key={notification?.id || Math.random()}
                    className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700"
                  >
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Error loading notification
                    </p>
                  </div>
                );
              }
            })
          ) : (
            <div className="p-8 text-center">
              {(() => {
                try {
                  return <BellIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />;
                } catch (error) {
                  logger.error('Failed to render bell icon:', error, 'NotificationPanel');
                  return <div className="w-12 h-12 text-gray-300 mx-auto mb-3 text-2xl">🔔</div>;
                }
              })()}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No notifications yet
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                You'll see budget alerts, transaction updates, and goal achievements here
              </p>
            </div>
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <button 
              onClick={() => {
                try {
                  logger.debug('Clear all notifications clicked', { componentName: 'NotificationPanel' });
                  onClearAll();
                } catch (error) {
                  logger.error('Failed to clear all notifications:', error, 'NotificationPanel');
                }
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear all
            </button>
            <Link 
              to="/notifications"
              onClick={() => {
                try {
                  logger.debug('View all notifications clicked', { componentName: 'NotificationPanel' });
                  onClose();
                } catch (error) {
                  logger.error('Failed to handle view all click:', error, 'NotificationPanel');
                }
              }}
              className="text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 font-medium"
            >
              View all
            </Link>
          </div>
        )}
      </div>
    );
  } catch (error) {
    logger.error('Failed to render NotificationPanel:', error, 'NotificationPanel');
    return (
      <div className="absolute right-0 mt-2 w-80 bg-red-50 dark:bg-red-900/20 rounded-lg shadow-lg border border-red-200 dark:border-red-700 z-[9999]">
        <div className="p-4">
          <div className="text-red-600 dark:text-red-400 font-medium">
            Notification Error
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Failed to load notifications
          </p>
          <button 
            onClick={() => {
              try {
                onClose();
              } catch (closeError) {
                logger.error('Failed to close notification panel:', closeError, 'NotificationPanel');
              }
            }}
            className="text-sm text-red-700 dark:text-red-300 mt-2 hover:underline"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
});