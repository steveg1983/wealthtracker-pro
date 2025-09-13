import { memo, useEffect } from 'react';
import { BellIcon, AlertCircleIcon, CheckIcon, XIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface InsightsStatsProps {
  stats: {
    total: number;
    active: number;
    dismissed: number;
    high: number;
    medium: number;
    low: number;
  };
}

export const InsightsStats = memo(function InsightsStats({ stats }: InsightsStatsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('InsightsStats component initialized', {
      componentName: 'InsightsStats'
    });
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.active}
            </p>
          </div>
          <BellIcon size={24} className="text-blue-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">High Priority</p>
            <p className="text-2xl font-bold text-red-600">
              {stats.high}
            </p>
          </div>
          <AlertCircleIcon size={24} className="text-red-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Dismissed</p>
            <p className="text-2xl font-bold text-gray-500">
              {stats.dismissed}
            </p>
          </div>
          <XIcon size={24} className="text-gray-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total}
            </p>
          </div>
          <CheckIcon size={24} className="text-green-400" />
        </div>
      </div>
    </div>
  );
});