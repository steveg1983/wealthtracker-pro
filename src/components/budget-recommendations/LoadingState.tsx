/**
 * @component LoadingState
 * @description Loading state for budget recommendations
 */

import { memo, useEffect } from 'react';
import { logger } from '../../services/loggingService';

export const LoadingState = memo(function LoadingState(): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('LoadingState component initialized', {
      componentName: 'LoadingState'
    });
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
});