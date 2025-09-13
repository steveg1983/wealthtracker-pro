import { memo, useEffect } from 'react';
import { InfoIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

/**
 * Portfolio info note component
 * Displays educational information about Modern Portfolio Theory
 */
export const PortfolioInfoNote = memo(function PortfolioInfoNote(): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PortfolioInfoNote component initialized', {
      componentName: 'PortfolioInfoNote'
    });
  }, []);

  return (
    <div className="mt-6 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
      <div className="flex gap-2">
        <InfoIcon size={14} className="text-gray-600 dark:text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-900 dark:text-blue-100">
          <p className="font-medium mb-1">About Modern Portfolio Theory:</p>
          <ul className="space-y-0.5">
            <li>• The efficient frontier shows the best possible risk-return combinations</li>
            <li>• Sharpe ratio measures risk-adjusted returns (higher is better)</li>
            <li>• Diversification can reduce risk without sacrificing returns</li>
            <li>• Past performance does not guarantee future results</li>
          </ul>
        </div>
      </div>
    </div>
  );
});