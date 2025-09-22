import React, { useEffect, memo } from 'react';
import { PieChartIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface BudgetOverviewProps {
  budgetStatus: any[];
  overallBudgetPercent: number;
  formatCurrency: (value: number, currency?: string) => string;
  displayCurrency?: string;
  t: (key: string, defaultValue: string) => string;
  onNavigate: (path: string) => void;
}

export const BudgetOverview = memo(function BudgetOverview({ budgetStatus,
  overallBudgetPercent,
  formatCurrency,
  displayCurrency,
  t,
  onNavigate
 }: BudgetOverviewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetOverview component initialized', {
      componentName: 'BudgetOverview'
    });
  }, []);

  if (budgetStatus.length === 0) return <></>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <PieChartIcon size={24} className="text-gray-500" />
          {t('dashboard.budgetStatus', 'Budget Status')}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {overallBudgetPercent.toFixed(0)}% {t('dashboard.used', 'used')}
        </span>
      </div>
      
      <div className="space-y-3">
        {budgetStatus.slice(0, 3).map(budget => (
          <div key={budget.id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {budget.name || budget.categoryId || budget.category}
              </span>
              <span className={`font-medium ${
                budget.percentUsed > 100 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {formatCurrency(budget.spent, displayCurrency)} / {formatCurrency(budget.amount, displayCurrency)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  budget.percentUsed > 100 ? 'bg-red-500' :
                  budget.percentUsed > 80 ? 'bg-yellow-500' :
                  budget.percentUsed > 60 ? 'bg-gray-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
              />
            </div>
          </div>
        ))}
        
        {budgetStatus.length > 3 && (
          <button 
            onClick={() => onNavigate('/budget')}
            className="w-full mt-2 py-2 text-gray-600 dark:text-gray-500 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            {t('dashboard.viewAllBudgets', 'View All Budgets')} ({budgetStatus.length}) →
          </button>
        )}
      </div>
    </div>
  );
});
