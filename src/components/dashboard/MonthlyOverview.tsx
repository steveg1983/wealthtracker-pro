import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, TrendingDownIcon, TargetIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface MonthlyOverviewProps {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  formatCurrency: (value: number, currency?: string) => string;
  displayCurrency?: string;
  t: (key: string, defaultValue: string) => string;
}

export const MonthlyOverview = memo(function MonthlyOverview({ monthlyIncome,
  monthlyExpenses,
  monthlySavings,
  savingsRate,
  formatCurrency,
  displayCurrency,
  t
 }: MonthlyOverviewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('MonthlyOverview component initialized', {
      componentName: 'MonthlyOverview'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('dashboard.monthlyOverview', 'Monthly Overview')}
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 mb-2">
            <TrendingUpIcon size={24} className="text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {t('dashboard.income', 'Income')}
          </p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatCurrency(monthlyIncome, displayCurrency)}
          </p>
        </div>
        
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-2">
            <TrendingDownIcon size={24} className="text-red-600 dark:text-red-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {t('dashboard.expenses', 'Expenses')}
          </p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatCurrency(monthlyExpenses, displayCurrency)}
          </p>
        </div>
        
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-2">
            <TargetIcon size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {t('dashboard.savings', 'Savings')}
          </p>
          <p className={`text-lg font-bold ${
            monthlySavings >= 0 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(monthlySavings, displayCurrency)}
          </p>
          {savingsRate > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {savingsRate.toFixed(1)}% {t('dashboard.rate', 'rate')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});