import { memo, useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon, WalletIcon, TargetIcon, ChevronRightIcon } from '../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { DashboardMetrics } from '../../../services/improvedDashboardService';
import { useLogger } from '../services/ServiceProvider';

interface MonthlyPerformanceProps {
  metrics: DashboardMetrics;
  formatCurrency: (amount: number) => string;
  onNavigateToBudgets: () => void;
}

/**
 * Monthly performance component
 */
export const MonthlyPerformance = memo(function MonthlyPerformance({ metrics,
  formatCurrency,
  onNavigateToBudgets
 }: MonthlyPerformanceProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('MonthlyPerformance component initialized', {
      componentName: 'MonthlyPerformance'
    });
  }, []);

  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('dashboard.thisMonthPerformance', "This Month's Performance")}
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.income', 'Income')}</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(metrics.monthlyIncome)}
            </p>
          </div>
          <TrendingUpIcon size={24} className="text-green-500" />
        </div>
        
        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.expenses', 'Expenses')}</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(metrics.monthlyExpenses)}
            </p>
          </div>
          <TrendingDownIcon size={24} className="text-red-500" />
        </div>
        
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.savings', 'Savings')}</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(metrics.monthlySavings)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {metrics.savingsRate.toFixed(1)}% rate
            </p>
          </div>
          <WalletIcon size={24} className="text-blue-500" />
        </div>
      </div>
      
      {/* Budget Status */}
      {metrics.budgetStatus.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {t('dashboard.budgetStatus', 'Budget Status')}
            </h4>
            <button
              onClick={onNavigateToBudgets}
              className="text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 flex items-center gap-1"
            >
              View All
              <ChevronRightIcon size={14} />
            </button>
          </div>
          
          {/* Overall Budget Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Overall</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(metrics.totalSpentOnBudgets)} / {formatCurrency(metrics.totalBudgeted)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className={`rounded-full h-2 transition-all ${
                  metrics.overallBudgetPercent > 100 
                    ? 'bg-red-500' 
                    : metrics.overallBudgetPercent > 80 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, metrics.overallBudgetPercent)}%` }}
              />
            </div>
          </div>
          
          {/* Top 3 Budget Categories */}
          <div className="space-y-2">
            {metrics.budgetStatus.slice(0, 3).map(budget => (
              <div key={budget.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <TargetIcon size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{budget.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    budget.isOverBudget ? 'text-red-600' : 'text-gray-900 dark:text-white'
                  }`}>
                    {budget.percentUsed.toFixed(0)}%
                  </span>
                  <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                    <div
                      className={`rounded-full h-1.5 ${
                        budget.isOverBudget ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});