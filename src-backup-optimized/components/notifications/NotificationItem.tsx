import React, { useEffect, memo } from 'react';
import {
  XIcon,
  InfoIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon
} from '../icons';
import type { Notification } from './types';
import { useLogger } from '../services/ServiceProvider';

interface NotificationItemProps {
  notification: Notification;
  style: React.CSSProperties;
  onRemove: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  formatTime: (date: Date) => string;
}

const getIcon = (type: string): React.JSX.Element => {
  switch (type) {
    case 'success': return <CheckCircleIcon size={16} className="text-green-600" />;
    case 'warning': return <AlertCircleIcon size={16} className="text-yellow-600" />;
    case 'error': return <XCircleIcon size={16} className="text-red-600" />;
    default: return <InfoIcon size={16} className="text-gray-600" />;
  }
};

export const NotificationItem = memo(function NotificationItem({ notification,
  style,
  onRemove,
  onMarkAsRead,
  formatTime
 }: NotificationItemProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('NotificationItem component initialized', {
      componentName: 'NotificationItem'
    });
  }, []);

  return (
    <div
      style={style}
      className={`p-4 rounded-lg border transition-all hover:shadow-md ${
        !notification.read
          ? 'bg-blue-50 dark:bg-gray-900/20 border-blue-200 dark:border-blue-700'
          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={`font-medium text-sm text-gray-900 dark:text-white ${
                !notification.read ? 'font-semibold' : ''
              }`}>
                {notification.title}
              </p>
              {notification.message && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {notification.message}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {formatTime(notification.timestamp)}
              </p>
            </div>
            <button
              onClick={() => onRemove(notification.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {notification.action && (
              <button
                onClick={() => {
                  onMarkAsRead(notification.id);
                  notification.action!.onClick();
                }}
                className="text-xs text-gray-600 hover:text-blue-700 font-medium"
              >
                {notification.action.label}
              </button>
            )}
            {!notification.read && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});