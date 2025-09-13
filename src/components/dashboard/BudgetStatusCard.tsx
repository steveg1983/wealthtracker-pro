import React, { useEffect, memo } from 'react';
import { PieChartIcon, AlertCircleIcon } from '../icons';
import { logger } from '../../services/loggingService';

export interface BudgetStatus {
  id: string;
  category: string; // display name
  amount: number;
  spent: number;
  percentage: number;
  isOverBudget: boolean;
}

interface BudgetStatusCardProps {
  budgetStatus: BudgetStatus[];
  overallBudgetPercent: number;
  formatCurrency: (value: number) => string;
  t: (key: string, defaultValue: string) => string;
  onNavigate?: () => void;
}

export const BudgetStatusCard = memo(function BudgetStatusCard({
  budgetStatus,
  overallBudgetPercent,
  formatCurrency,
  t,
  onNavigate
}: BudgetStatusCardProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetStatusCard component initialized', {
      componentName: 'BudgetStatusCard'
    });
  }, []);

  if (budgetStatus.length === 0) return null;

  const hasOverspending = budgetStatus.some(b => b.isOverBudget);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6" data-testid="budget-status">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <PieChartIcon size={24} className="text-gray-500" />
        {t('dashboard.budgetStatus', 'Budget Status')}
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({overallBudgetPercent.toFixed(0)}% {t('dashboard.used', 'used')})
        </span>
      </h3>
      
      <div className="space-y-3">
        {budgetStatus.slice(0, 3).map(budget => (
          <div key={budget.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {budget.category}
              </span>
              <span className={`font-medium ${
                budget.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  budget.isOverBudget 
                    ? 'bg-red-500' 
                    : budget.percentage > 75 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, budget.percentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {hasOverspending && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
          <AlertCircleIcon size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
              {t('dashboard.overspendingAlert', 'Overspending Detected')}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {t('dashboard.reviewBudgets', 'Review your budgets to stay on track')}
            </p>
          </div>
        </div>
      )}

      {budgetStatus.length > 3 && onNavigate && (
        <button 
          onClick={onNavigate}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('dashboard.viewAllBudgets', 'View all budgets')} →
        </button>
      )}
    </div>
  );
});
