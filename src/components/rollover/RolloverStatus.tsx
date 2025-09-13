import { memo, useEffect } from 'react';
import { CheckCircleIcon, AlertCircleIcon } from '../icons';
import type { RolloverSettings } from './types';
import { logger } from '../../services/loggingService';

interface RolloverStatusProps {
  settings: RolloverSettings;
}

export const RolloverStatus = memo(function RolloverStatus({ settings }: RolloverStatusProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RolloverStatus component initialized', {
      componentName: 'RolloverStatus'
    });
  }, []);

  return (
    <div className="flex items-center gap-2">
      {settings.enabled ? (
        <>
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">Active</span>
        </>
      ) : (
        <>
          <AlertCircleIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Inactive</span>
        </>
      )}
    </div>
  );
});