import { memo, useEffect } from 'react';
import { RepeatIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

export const RolloverHeader = memo(function RolloverHeader(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RolloverHeader component initialized', {
      componentName: 'RolloverHeader'
    });
  }, []);

  return (
    <div className="mb-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <RepeatIcon className="h-5 w-5" />
        Budget Rollover
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Automatically carry forward unused budget amounts to future periods
      </p>
    </div>
  );
});