/**
 * @component CompactView
 * @description Compact budget progress display for limited space
 */

import { memo, useEffect } from 'react';
import { BudgetProgressBar } from './BudgetProgressBar';
import type { CompactViewProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const CompactView = memo(function CompactView({ budget,
  metrics,
  formatCurrency
 }: CompactViewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CompactView component initialized', {
      componentName: 'CompactView'
    });
  }, []);

  
  const getStatusColor = () => {
    switch (metrics.status) {
      case 'under':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'over':
        return 'text-red-600';
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {budget.name}
        </h4>
        <span className={`text-sm font-semibold ${getStatusColor()}`}>
          {metrics.percentage.toFixed(0)}%
        </span>
      </div>
      
      <BudgetProgressBar
        percentage={metrics.percentage}
        velocity={{
          dailyAverage: metrics.velocity.dailyAverage,
          projectedTotal: metrics.velocity.projectedTotal,
          daysRemaining: metrics.velocity.daysRemaining,
          percentOfPeriodElapsed: 0,
          isOnTrack: metrics.velocity.isOnTrack,
          willExceed: metrics.percentage >= 100 || !metrics.velocity.isOnTrack,
          recommendedDailyLimit: metrics.velocity.recommendedDailyBudget
        }}
        spent={metrics.spent}
        amount={budget.amount}
        formatCurrency={formatCurrency}
        showDetails={false}
      />
      
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">
          {formatCurrency(metrics.spent)} spent
        </span>
        <span className="text-xs text-gray-500">
          {formatCurrency(metrics.remaining)} left
        </span>
      </div>
      
      {metrics.velocity.daysRemaining > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Daily budget: {formatCurrency(metrics.velocity.recommendedDailyBudget)}
            </span>
            <span className="text-gray-500">
              {metrics.velocity.daysRemaining} days left
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
