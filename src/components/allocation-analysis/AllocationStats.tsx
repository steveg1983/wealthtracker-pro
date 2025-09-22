import React, { useEffect, memo } from 'react';
import { InfoIcon } from '../icons';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import { useLogger } from '../services/ServiceProvider';

interface AllocationStatsProps {
  totalValue: number;
  largestHolding: AssetAllocation | null;
  allocationsCount: number;
  formatCurrency: (value: number) => string;
}

export const AllocationStats = memo(function AllocationStats({ totalValue,
  largestHolding,
  allocationsCount,
  formatCurrency
 }: AllocationStatsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AllocationStats component initialized', {
      componentName: 'AllocationStats'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
          <InfoIcon size={16} />
          Total Value
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totalValue)}
        </div>
      </div>
      
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
          <InfoIcon size={16} />
          Largest Holding
        </div>
        <div className="text-lg font-semibold text-gray-900 dark:text-white">
          {largestHolding ? largestHolding.assetClass : 'N/A'}
        </div>
        {largestHolding && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {largestHolding.currentPercent.toFixed(1)}% of portfolio
          </div>
        )}
      </div>
      
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
          <InfoIcon size={16} />
          Diversification
        </div>
        <div className="text-lg font-semibold text-gray-900 dark:text-white">
          {allocationsCount} Holdings
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {allocationsCount > 10 ? 'Well diversified' : 'Consider more diversification'}
        </div>
      </div>
    </div>
  );
});