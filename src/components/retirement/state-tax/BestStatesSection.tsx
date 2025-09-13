/**
 * @component BestStatesSection
 * @description Displays best states for retirement based on tax rates
 */

import { memo, useEffect } from 'react';
import { TrophyIcon } from '../../icons';
import type { BestStatesSectionProps } from './types';
import { logger } from '../../../services/loggingService';

export const BestStatesSection = memo(function BestStatesSection({ 
  bestStates, 
  formatCurrency 
}: BestStatesSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BestStatesSection component initialized', {
      componentName: 'BestStatesSection'
    });
  }, []);

  return (
    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <TrophyIcon size={20} className="text-green-600" />
        <h4 className="font-medium text-gray-900 dark:text-white">
          Best States for Retirement (Tax-wise)
        </h4>
      </div>
      <div className="space-y-2">
        {bestStates.map((result, index) => (
          <div key={result.state} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`
                font-medium ${index === 0 ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'}
              `}>
                #{index + 1}
              </span>
              <span className="text-gray-900 dark:text-white">
                {result.state}
              </span>
            </div>
            <div className="text-right">
              <span className="font-medium">
                {formatCurrency(result.totalTax)}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                ({result.effectiveRate.toFixed(2)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});