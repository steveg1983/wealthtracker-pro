import { memo, useEffect } from 'react';
import { AlertTriangleIcon, AlertCircleIcon } from '../../components/icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { BudgetAlert } from '../../services/budgetPageService';
import { logger } from '../../services/loggingService';

interface BudgetAlertsProps {
  alerts: BudgetAlert[];
}

export const BudgetAlerts = memo(function BudgetAlerts({ alerts }: BudgetAlertsProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetAlerts component initialized', {
      componentName: 'BudgetAlerts'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();
  
  if (alerts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Budget Alerts
      </h3>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.budgetId}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              alert.type === 'danger' 
                ? 'bg-red-50 dark:bg-red-900/20' 
                : 'bg-yellow-50 dark:bg-yellow-900/20'
            }`}
          >
            {alert.type === 'danger' ? (
              <AlertTriangleIcon 
                size={20} 
                className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" 
              />
            ) : (
              <AlertCircleIcon 
                size={20} 
                className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" 
              />
            )}
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {alert.categoryName}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {alert.type === 'danger' ? (
                  <span>
                    Over budget by {formatCurrency(alert.spent - alert.budget)} 
                    ({alert.percentage}% of {formatCurrency(alert.budget)} {alert.period} budget)
                  </span>
                ) : (
                  <span>
                    {alert.percentage}% of {formatCurrency(alert.budget)} {alert.period} budget used
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
