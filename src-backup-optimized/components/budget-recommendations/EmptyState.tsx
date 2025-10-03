/**
 * @component EmptyState
 * @description Empty state when no budget analysis is available
 */

import { memo, useEffect } from 'react';
import { InfoIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

export const EmptyState = memo(function EmptyState(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyState component initialized', {
      componentName: 'EmptyState'
    });
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="text-center py-12">
        <InfoIcon size={48} className="mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Budget Analysis Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Add some transactions and budgets to get personalized recommendations
        </p>
      </div>
    </div>
  );
});