import React, { memo } from 'react';
import { formatCurrency } from '../../utils/currency';
import { logger } from '../../services/loggingService';

interface BalanceSummaryProps {
  currentBalance: number;
  newBalanceNum: number;
  difference: number;
  isIncrease: boolean;
  currency: string;
}

/**
 * Balance summary display component
 * Shows current, new balance and adjustment amount with proper formatting
 */
export const BalanceSummary = memo(function BalanceSummary({
  currentBalance,
  newBalanceNum,
  difference,
  isIncrease,
  currency
}: BalanceSummaryProps): React.JSX.Element {
  try {
    return (
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Current Balance</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(currentBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">New Balance</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(newBalanceNum, currency)}
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-400">Adjustment Amount</p>
          <p className={`text-lg font-bold ${
            isIncrease ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isIncrease ? '+' : '-'}{formatCurrency(Math.abs(difference), currency)}
          </p>
        </div>
      </div>
    );
  } catch (error) {
    logger.error('BalanceSummary render error:', error);
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400 text-sm">
          Error displaying balance summary
        </p>
      </div>
    );
  }
});