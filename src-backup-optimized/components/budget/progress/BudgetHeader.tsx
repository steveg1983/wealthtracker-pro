/**
 * @component BudgetHeader
 * @description Header section displaying budget name, category, and status
 */

import { memo, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  AlertTriangleIcon, 
  DollarSignIcon 
} from '../../icons';
import type { BudgetHeaderProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const BudgetHeader = memo(function BudgetHeader({ budget,
  category,
  metrics,
  formatCurrency
 }: BudgetHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetHeader component initialized', {
      componentName: 'BudgetHeader'
    });
  }, []);

  const getStatusIcon = () => {
    switch (metrics.status) {
      case 'under':
        return <CheckCircleIcon size={20} className="text-green-600" />;
      case 'warning':
        return <AlertTriangleIcon size={20} className="text-yellow-600" />;
      case 'over':
        return <AlertTriangleIcon size={20} className="text-red-600" />;
    }
  };

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
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {budget.name}
          </h3>
          {category && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {category.name}
            </p>
          )}
        </div>
      </div>
      
      <div className="text-right">
        <div className={`text-2xl font-bold ${getStatusColor()}`}>
          {formatCurrency(metrics.spent)}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          of {formatCurrency(budget.amount)}
        </div>
      </div>
    </div>
  );
});