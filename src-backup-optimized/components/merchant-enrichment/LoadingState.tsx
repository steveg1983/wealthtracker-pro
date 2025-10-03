/**
 * @component LoadingState
 * @description Loading indicator for merchant enrichment
 */

import { memo, useEffect } from 'react';
import { RefreshCwIcon } from '../icons';
import type { LoadingStateProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const LoadingState = memo(function LoadingState({ message = 'Loading...',
  showProgress = false,
  progress = 0
 }: LoadingStateProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('LoadingState component initialized', {
      componentName: 'LoadingState'
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <RefreshCwIcon 
        size={32} 
        className="text-blue-600 animate-spin mb-4" 
      />
      <p className="text-gray-600 dark:text-gray-400">
        {message}
      </p>
      
      {showProgress && (
        <div className="mt-4 w-64">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {Math.round(progress)}% complete
          </p>
        </div>
      )}
    </div>
  );
});