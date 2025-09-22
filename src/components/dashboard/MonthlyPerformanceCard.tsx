import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, TrendingDownIcon, TargetIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface MonthlyPerformanceCardProps {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  formatCurrency: (value: number) => string;
  t: (key: string, defaultValue: string) => string;
}

export const MonthlyPerformanceCard = memo(function MonthlyPerformanceCard({ monthlyIncome,
  monthlyExpenses,
  monthlySavings,
  savingsRate,
  formatCurrency,
  t
 }: MonthlyPerformanceCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('MonthlyPerformanceCard component initialized', {
      componentName: 'MonthlyPerformanceCard'
    });
  }, []);

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
              {formatCurrency(monthlyIncome)}
            </p>
          </div>
          <TrendingUpIcon size={24} className="text-green-500" />
        </div>
        
        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.expenses', 'Expenses')}</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(monthlyExpenses)}
            </p>
          </div>
          <TrendingDownIcon size={24} className="text-red-500" />
        </div>
        
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.saved', 'Saved')}</p>
            <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
              {formatCurrency(monthlySavings)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {savingsRate.toFixed(1)}% {t('dashboard.rate', 'rate')}
            </p>
          </div>
          <TargetIcon size={24} className="text-gray-500" />
        </div>
      </div>
    </div>
  );
});