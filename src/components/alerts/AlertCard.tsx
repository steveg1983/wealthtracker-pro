import React, { useEffect, memo } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { AlertCircleIcon, XIcon } from '../icons';
import type { Alert } from './types';
import { useLogger } from '../services/ServiceProvider';

interface AlertCardProps {
  alert: Alert;
  onMarkAsRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
}

export const AlertCard = memo(function AlertCard({ alert,
  onMarkAsRead,
  onDismiss
 }: AlertCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AlertCard component initialized', {
      componentName: 'AlertCard'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div
      className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-lg shadow border border-white/20 dark:border-gray-700/50 p-4 transition-all cursor-pointer ${
        !alert.isRead ? 'border-l-4 border-l-blue-500' : ''
      }`}
      onClick={() => onMarkAsRead(alert.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`mt-1 ${
            alert.type === 'critical' ? 'text-red-500' : 'text-yellow-500'
          }`}>
            <AlertCircleIcon size={20} />
          </div>
          <div className="flex-1">
            <h4 className={`font-medium text-gray-900 dark:text-white ${
              !alert.isRead ? 'font-semibold' : ''
            }`}>
              {alert.message}
            </h4>
            <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <p>
                Spent: {formatCurrency(alert.spent)} of {formatCurrency(alert.budget)} 
                ({alert.percentage.toFixed(0)}%)
              </p>
              <p>
                Remaining: <span className={alert.remaining.greaterThan(0) ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(alert.remaining)}
                </span>
              </p>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(alert.id);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Dismiss alert"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
});