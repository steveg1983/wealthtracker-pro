import React, { useEffect, memo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { ChevronRightIcon, TrendingUpIcon } from '../icons';
import type { BudgetRolloverData } from './types';
import type { DecimalInstance } from '../../utils/decimal';
import { logger } from '../../services/loggingService';

interface RolloverDetailsProps {
  categories: BudgetRolloverData[];
  totalRollover: DecimalInstance;
}

export const RolloverDetails = memo(function RolloverDetails({ 
  categories, 
  totalRollover 
}: RolloverDetailsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RolloverDetails component initialized', {
      componentName: 'RolloverDetails'
    });
  }, []);

  const activeRollovers = categories.filter(cat => cat.rolloverAmount.greaterThan(0));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <TrendingUpIcon size={20} className="text-green-500" />
          Rollover Preview
        </h3>
        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
          {formatCurrency(totalRollover.toNumber())}
        </span>
      </div>

      <div className="space-y-3">
        {activeRollovers.map(cat => (
          <div 
            key={cat.category} 
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium">{cat.category}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Available: {formatCurrency(cat.remaining.toNumber())}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ChevronRightIcon size={16} className="text-gray-400" />
              <span className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(cat.rolloverAmount.toNumber())}
              </span>
            </div>
          </div>
        ))}

        {activeRollovers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No budget available to roll over from the previous month
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Categories with rollover:</span>
            <div className="font-medium">{activeRollovers.length}</div>
          </div>
          <div>
            <span className="text-gray-500">Total amount:</span>
            <div className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(totalRollover.toNumber())}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});