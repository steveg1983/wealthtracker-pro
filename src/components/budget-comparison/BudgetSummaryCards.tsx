import { memo, useEffect } from 'react';
import { 
  BarChart3Icon, 
  TrendingUpIcon, 
  TrendingDownIcon 
} from '../icons';
import { formatCurrency } from '../../utils/formatters';
import { logger } from '../../services/loggingService';

interface BudgetSummaryTotals {
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  overBudgetCategories: number;
  warningCategories: number;
  onTrackCategories: number;
  underBudgetCategories: number;
}

interface BudgetSummaryCardsProps {
  totals: BudgetSummaryTotals;
}

/**
 * Budget summary cards component
 * Extracted from BudgetComparison for single responsibility
 */
export const BudgetSummaryCards = memo(function BudgetSummaryCards({ totals }: BudgetSummaryCardsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetSummaryCards component initialized', {
      componentName: 'BudgetSummaryCards'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Budgeted</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(totals.budgeted)}
            </p>
          </div>
          <BarChart3Icon className="h-8 w-8 text-gray-400" />
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(totals.actual)}
            </p>
          </div>
          {totals.actual > totals.budgeted ? (
            <TrendingUpIcon className="h-8 w-8 text-red-500" />
          ) : (
            <TrendingDownIcon className="h-8 w-8 text-green-500" />
          )}
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Variance</p>
            <p className={`text-xl font-bold ${
              totals.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
            </p>
          </div>
          <span className={`text-sm font-medium px-2 py-1 rounded-full ${
            totals.variance >= 0 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}>
            {Math.abs(totals.variancePercent).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Category Status</p>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-red-600 dark:text-red-400">Over Budget</span>
            <span className="font-medium">{totals.overBudgetCategories}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-yellow-600 dark:text-yellow-400">Warning</span>
            <span className="font-medium">{totals.warningCategories}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-green-600 dark:text-green-400">On Track</span>
            <span className="font-medium">{totals.onTrackCategories + totals.underBudgetCategories}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
