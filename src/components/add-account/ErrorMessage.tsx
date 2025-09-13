import React, { useEffect, memo } from 'react';
import { AlertCircleIcon as AlertCircle } from '../icons';
import { logger } from '../../services/loggingService';

interface ErrorMessageProps {
  error: string | null;
}

export const ErrorMessage = memo(function ErrorMessage({ error }: ErrorMessageProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('ErrorMessage component initialized', {
      componentName: 'ErrorMessage'
    });
  }, []);

  if (!error) return null;

  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
      <div className="flex gap-3">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
        <div className="text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    </div>
  );
});
