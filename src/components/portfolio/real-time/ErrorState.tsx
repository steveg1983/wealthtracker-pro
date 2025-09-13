/**
 * @component ErrorState
 * @description Error state display with retry functionality
 */

import { memo, useEffect } from 'react';
import { AlertCircleIcon, RefreshCwIcon } from '../../icons';
import type { ErrorStateProps } from './types';
import { logger } from '../../../services/loggingService';

export const ErrorState = memo(function ErrorState({ 
  error, 
  onRetry 
}: ErrorStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ErrorState component initialized', {
      componentName: 'ErrorState'
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg">
      <AlertCircleIcon size={48} className="text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Unable to Load Portfolio Data
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-4 max-w-md">
        {error || 'An error occurred while loading your portfolio. Please try again.'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <RefreshCwIcon size={16} />
        Retry
      </button>
    </div>
  );
});