import { memo, useEffect } from 'react';
import { logger } from '../../services/loggingService';

interface BalanceSummaryProps {
  clearedBalance: number;
  statementBalance: string;
  statementDifference: number;
  unclearedCount: number;
  formatCurrency: (amount: number) => string;
}

/**
 * Balance summary component
 * Shows current balance status and differences
 */
export const BalanceSummary = memo(function BalanceSummary({
  clearedBalance,
  statementBalance,
  statementDifference,
  unclearedCount,
  formatCurrency
}: BalanceSummaryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BalanceSummary component initialized', {
      componentName: 'BalanceSummary'
    });
  }, []);

  const isBalanced = Math.abs(statementDifference) < 0.01;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">Cleared Balance</div>
        <div className="text-xl font-semibold mt-1">{formatCurrency(clearedBalance)}</div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">Statement Balance</div>
        <div className="text-xl font-semibold mt-1">
          {statementBalance ? formatCurrency(parseFloat(statementBalance)) : '-'}
        </div>
      </div>
      
      <div className={`rounded-lg p-4 border ${
        isBalanced
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}>
        <div className="text-sm text-gray-600 dark:text-gray-400">Difference</div>
        <div className={`text-xl font-semibold mt-1 ${
          isBalanced
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        }`}>
          {formatCurrency(statementDifference)}
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">Uncleared</div>
        <div className="text-xl font-semibold mt-1">{unclearedCount}</div>
      </div>
    </div>
  );
});