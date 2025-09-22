import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import {
  CreditCardIcon,
  DollarSignIcon,
  TrendingDownIcon,
  TargetIcon
} from '../icons';
import type { DecimalInstance } from '../../types/decimal-types';
import { useLogger } from '../services/ServiceProvider';

interface DebtSummaryCardsProps {
  totalDebt: DecimalInstance;
  totalMinimumPayments: number;
  extraPayment: number;
  strategy: 'avalanche' | 'snowball' | 'custom';
  selectedAccountsCount: number;
}

export const DebtSummaryCards = memo(function DebtSummaryCards({ totalDebt,
  totalMinimumPayments,
  extraPayment,
  strategy,
  selectedAccountsCount
 }: DebtSummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DebtSummaryCards component initialized', {
      componentName: 'DebtSummaryCards'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Debt</h3>
          <CreditCardIcon size={20} className="text-red-500" />
        </div>
        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
          {formatCurrency(totalDebt.toNumber())}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Across {selectedAccountsCount} accounts
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Min. Payment</h3>
          <DollarSignIcon size={20} className="text-yellow-500" />
        </div>
        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
          {formatCurrency(totalMinimumPayments)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Monthly minimum
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Extra Payment</h3>
          <TrendingDownIcon size={20} className="text-green-500" />
        </div>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {formatCurrency(extraPayment)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Accelerate payoff
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Strategy</h3>
          <TargetIcon size={20} className="text-gray-500" />
        </div>
        <p className="text-lg font-bold text-gray-600 dark:text-gray-500 capitalize">
          {strategy}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {strategy === 'avalanche' ? 'Highest APR first' : strategy === 'snowball' ? 'Smallest balance first' : 'Custom order'}
        </p>
      </div>
    </div>
  );
});
