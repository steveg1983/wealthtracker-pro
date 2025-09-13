/**
 * @component EmptyState
 * @description Empty state display when no calculations exist
 */

import { memo, useEffect } from 'react';
import { logger } from '../../../services/loggingService';

interface EmptyStateProps {
  onNewCalculation: () => void;
}

export const EmptyState = memo(function EmptyState({ 
  onNewCalculation 
}: EmptyStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyState component initialized', {
      componentName: 'EmptyState'
    });
  }, []);

  return (
    <div className="text-center py-12">
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        No calculations yet. Start by creating your first mortgage calculation.
      </p>
      <button
        onClick={onNewCalculation}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
      >
        Create First Calculation
      </button>
    </div>
  );
});