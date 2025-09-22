/**
 * Budget Category Item Component
 * Displays individual budget category with progress
 */

import React, { useEffect, memo } from 'react';
import { 
  ArrowUpIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import type { BudgetComparison } from '../../services/budgetComparisonService';
import { budgetComparisonService } from '../../services/budgetComparisonService';
import { useLogger } from '../services/ServiceProvider';
interface BudgetCategoryItemProps {
  comparison: BudgetComparison;
  formatCurrency: (value: number) => string;
  navigate: (path: string) => void;
}

export const BudgetCategoryItem = memo(function BudgetCategoryItem({
  comparison,
  formatCurrency,
  navigate
}: BudgetCategoryItemProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetCategoryItem component initialized', {
      componentName: 'BudgetCategoryItem'
    });
  }, []);

  const progressColor = budgetComparisonService.getProgressBarColor(
    comparison.percentUsed,
    comparison.isOverBudget
  );
  
  const handleClick = () => {
    navigate(budgetComparisonService.formatCategoryUrl(comparison.category));
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {comparison.category}
        </h4>
        <div className="flex items-center">
          {comparison.isOverBudget ? (
            <ArrowUpIcon className="h-4 w-4 text-red-500 mr-1" />
          ) : comparison.percentUsed < 50 ? (
            <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
          ) : null}
          <span className={`text-sm font-semibold ${
            comparison.isOverBudget 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {comparison.percentUsed.toFixed(0)}%
          </span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div 
          className={`h-2 rounded-full transition-all ${progressColor}`}
          style={{ width: `${Math.min(comparison.percentUsed, 100)}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{formatCurrency(comparison.actual)} spent</span>
        <span>{formatCurrency(comparison.budgeted)} budget</span>
      </div>
    </div>
  );
});
