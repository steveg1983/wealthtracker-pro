/**
 * Budget Summary Card Component
 * Displays overall budget status with progress bar
 */

import React, { useEffect, memo } from 'react';
import type { BudgetTotals } from '../../../services/budgetComparisonService';
import { logger } from '../../../services/loggingService';

interface BudgetSummaryCardProps {
  totals: BudgetTotals;
  formatCurrency: (value: number) => string;
  showVariance?: boolean;
  colorClasses: {
    background: string;
    text: string;
    progress: string;
  };
}

export const BudgetSummaryCard = memo(function BudgetSummaryCard({
  totals,
  formatCurrency,
  showVariance = true,
  colorClasses
}: BudgetSummaryCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetSummaryCard component initialized', {
      componentName: 'BudgetSummaryCard'
    });
  }, []);

  return (
    <div className={`rounded-lg p-4 ${colorClasses.background}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Overall Budget Status
        </span>
        <span className={`text-lg font-bold ${colorClasses.text}`}>
          {totals.percentUsed.toFixed(0)}% Used
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
        <div 
          className={`h-3 rounded-full transition-all ${colorClasses.progress}`}
          style={{ width: `${Math.min(totals.percentUsed, 100)}%` }}
        />
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-600 dark:text-gray-400">Budgeted</p>
          <p className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(totals.budgeted)}
          </p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Actual</p>
          <p className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(totals.actual)}
          </p>
        </div>
        {showVariance && (
          <div>
            <p className="text-gray-600 dark:text-gray-400">Variance</p>
            <p className={`font-semibold ${
              totals.variance >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});