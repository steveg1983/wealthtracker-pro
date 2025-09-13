import React, { useEffect, memo } from 'react';
import { CalendarIcon, CheckCircleIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface MilestonesCardProps {
  milestones: Array<{
    amount: number;
    expectedDate: Date;
    yearsAway: number;
  }>;
  formatCurrency: (value: number) => string;
}

export const MilestonesCard = memo(function MilestonesCard({
  milestones,
  formatCurrency
}: MilestonesCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('MilestonesCard component initialized', {
      componentName: 'MilestonesCard'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <CheckCircleIcon size={20} className="text-green-500" />
        Wealth Milestones
      </h3>

      <div className="space-y-3">
        {milestones.map((milestone, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-blue-50
                     dark:from-green-900/20 dark:to-blue-900/20 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400 font-bold text-sm">
                  {index + 1}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(milestone.amount)}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <CalendarIcon size={12} />
                  <span>
                    {milestone.yearsAway === 0
                      ? 'Already achieved!'
                      : milestone.yearsAway === 1
                      ? 'Next year'
                      : `In ${milestone.yearsAway} years`}
                  </span>
                  <span className="text-gray-500">
                    ({milestone.expectedDate.getFullYear()})
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {milestones.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Adjust your settings to see milestone projections
        </p>
      )}
    </div>
  );
});