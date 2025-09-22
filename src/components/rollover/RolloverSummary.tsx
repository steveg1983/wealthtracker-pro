import { memo, useEffect } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import type { RolloverSummary as RolloverSummaryType } from './types';
import { useLogger } from '../services/ServiceProvider';

interface RolloverSummaryProps {
  summary: RolloverSummaryType;
}

export const RolloverSummary = memo(function RolloverSummary({ summary  }: RolloverSummaryProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RolloverSummary component initialized', {
      componentName: 'RolloverSummary'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Total Rolled Forward</p>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {formatCurrency(summary.totalRolledOver.toNumber())}
        </p>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Categories Affected</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {summary.categoriesAffected}
        </p>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Last Rollover</p>
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          {summary.lastRolloverDate ? new Date(summary.lastRolloverDate).toLocaleDateString() : 'Never'}
        </p>
      </div>
    </div>
  );
});