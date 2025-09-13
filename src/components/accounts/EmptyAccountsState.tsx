import React, { useEffect, memo } from 'react';
import { logger } from '../../services/loggingService';

interface EmptyAccountsStateProps {
  message: string;
}

const EmptyAccountsState = memo(function EmptyAccountsState({
  message
}: EmptyAccountsStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyAccountsState component initialized', {
      componentName: 'EmptyAccountsState'
    });
  }, []);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8 text-center">
      <p className="text-gray-500 dark:text-gray-400">
        {message}
      </p>
    </div>
  );
});

export default EmptyAccountsState;