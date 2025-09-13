/**
 * Budget Detailed Table Component
 * Displays budget comparisons in table format
 */

import React, { useEffect, memo } from 'react';
import type { BudgetComparison } from '../../../services/budgetComparisonService';
import { budgetComparisonService } from '../../../services/budgetComparisonService';
import { logger } from '../../../services/loggingService';

interface BudgetDetailedTableProps {
  comparisons: BudgetComparison[];
  formatCurrency: (value: number) => string;
  navigate: (path: string) => void;
  showVariance?: boolean;
}

export const BudgetDetailedTable = memo(function BudgetDetailedTable({
  comparisons,
  formatCurrency,
  navigate,
  showVariance = true
}: BudgetDetailedTableProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetDetailedTable component initialized', {
      componentName: 'BudgetDetailedTable'
    });
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b dark:border-gray-700">
            <th className="text-left py-2 text-gray-600 dark:text-gray-400">Category</th>
            <th className="text-right py-2 text-gray-600 dark:text-gray-400">Budget</th>
            <th className="text-right py-2 text-gray-600 dark:text-gray-400">Actual</th>
            {showVariance && (
              <th className="text-right py-2 text-gray-600 dark:text-gray-400">Variance</th>
            )}
            <th className="text-right py-2 text-gray-600 dark:text-gray-400">%</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map(comparison => (
            <tr 
              key={comparison.category}
              className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              onClick={() => navigate(budgetComparisonService.formatCategoryUrl(comparison.category))}
            >
              <td className="py-2 font-medium text-gray-900 dark:text-white">
                {comparison.category}
              </td>
              <td className="text-right py-2 text-gray-600 dark:text-gray-400">
                {formatCurrency(comparison.budgeted)}
              </td>
              <td className="text-right py-2 text-gray-900 dark:text-white">
                {formatCurrency(comparison.actual)}
              </td>
              {showVariance && (
                <td className={`text-right py-2 ${
                  comparison.variance >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {comparison.variance >= 0 ? '+' : ''}{formatCurrency(comparison.variance)}
                </td>
              )}
              <td className={`text-right py-2 font-semibold ${
                comparison.isOverBudget 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-900 dark:text-white'
              }`}>
                {comparison.percentUsed.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});