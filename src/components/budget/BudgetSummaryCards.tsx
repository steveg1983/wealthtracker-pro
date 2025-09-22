import { memo, useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon } from '../../components/icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { BudgetTotals } from '../../services/budgetPageService';
import { useLogger } from '../services/ServiceProvider';

interface BudgetSummaryCardsProps {
  totals: BudgetTotals;
}

export const BudgetSummaryCards = memo(function BudgetSummaryCards({ totals  }: BudgetSummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetSummaryCards component initialized', {
      componentName: 'BudgetSummaryCards'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();
  
  const percentage = totals.totalBudgeted.isZero() 
    ? 0 
    : Math.round(totals.totalSpent.times(100).dividedBy(totals.totalBudgeted).toNumber());

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Budgeted
          </span>
          <TrendingUpIcon size={20} className="text-gray-600 dark:text-gray-500" />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totals.totalBudgeted.toNumber())}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Spent
          </span>
          <TrendingDownIcon size={20} className="text-red-600 dark:text-red-500" />
        </div>
        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
          {formatCurrency(totals.totalSpent.toNumber())}
        </div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {percentage}% of budget
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Remaining
          </span>
          <ActivityIcon size={20} className="text-green-600 dark:text-green-500" />
        </div>
        <div className={`text-2xl font-bold ${
          totals.totalRemaining.isNegative() 
            ? 'text-red-600 dark:text-red-400' 
            : 'text-green-600 dark:text-green-400'
        }`}>
          {formatCurrency(totals.totalRemaining.toNumber())}
        </div>
      </div>
    </div>
  );
});