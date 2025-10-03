import { memo } from 'react';
import { BanknoteIcon, TrendingUpIcon, PiggyBankIcon } from '../../components/icons';
import type { BudgetTotals } from './types';

interface BudgetSummaryProps {
  totals: BudgetTotals;
}

/**
 * Budget summary component showing totals
 * Displays total budgeted, spent, and remaining amounts
 */
export const BudgetSummary = memo(function BudgetSummary({ totals }: BudgetSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Budgeted</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totals.totalBudgeted}
            </p>
          </div>
          <BanknoteIcon className="text-blue-500" size={32} />
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Spent</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totals.totalSpent}
            </p>
          </div>
          <TrendingUpIcon className="text-orange-500" size={32} />
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Remaining</p>
            <p className={`text-2xl font-bold ${
              totals.totalRemainingValue >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {totals.totalRemaining}
            </p>
          </div>
          <PiggyBankIcon className="text-green-500" size={32} />
        </div>
      </div>
    </div>
  );
});