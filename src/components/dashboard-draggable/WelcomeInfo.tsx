import React, { useEffect, memo } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useLogger } from '../services/ServiceProvider';

const WelcomeInfo = memo(function WelcomeInfo(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('WelcomeInfo component initialized', {
      componentName: 'WelcomeInfo'
    });
  }, []);
  return (
    <div className="mb-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="w-4 h-4 text-secondary dark:text-primary flex-shrink-0" />
            <div>
              <span className="text-base font-bold text-gray-900 dark:text-white">
                Welcome to your customizable financial dashboard
              </span>
              <span className="ml-10 text-xs text-gray-700 dark:text-gray-300">
                Completely configurable, extremely flexible. You can start building your own financial dashboard from the ground up.
              </span>
            </div>
          </div>
          <button className="text-xs font-medium text-secondary dark:text-primary hover:underline flex-shrink-0 mr-6">
            Learn more �
          </button>
        </div>
      </div>
    </div>
  );
});

export default WelcomeInfo;
