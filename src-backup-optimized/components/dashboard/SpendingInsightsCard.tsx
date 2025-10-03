import React, { useEffect, memo } from 'react';
import { ActivityIcon, TrendingUpIcon, TrendingDownIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface SpendingCategory {
  category: string;
  amount: number;
  percentage: number;
}

interface SpendingInsightsCardProps {
  currentSpending: number;
  lastMonthSpending: number;
  spendingChange: number;
  spendingChangePercent: number;
  topCategories: SpendingCategory[];
  formatCurrency: (value: number) => string;
  t: (key: string, defaultValue: string) => string;
}

export const SpendingInsightsCard = memo(function SpendingInsightsCard({ currentSpending,
  lastMonthSpending,
  spendingChange,
  spendingChangePercent,
  topCategories,
  formatCurrency,
  t
 }: SpendingInsightsCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SpendingInsightsCard component initialized', {
      componentName: 'SpendingInsightsCard'
    });
  }, []);

  const isSpendingUp = spendingChange > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <ActivityIcon size={20} className="text-gray-500" />
        {t('dashboard.spendingInsights', 'Spending Insights')}
      </h3>

      <div className="space-y-4">
        {/* Spending comparison */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {t('dashboard.thisMonth', 'This month')}
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(currentSpending)}
            </span>
            <div className={`flex items-center gap-1 text-sm ${
              isSpendingUp 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-green-600 dark:text-green-400'
            }`}>
              {isSpendingUp ? (
                <TrendingUpIcon size={16} />
              ) : (
                <TrendingDownIcon size={16} />
              )}
              <span>{Math.abs(spendingChangePercent).toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('dashboard.vsLastMonth', 'vs last month')}: {formatCurrency(lastMonthSpending)}
          </p>
        </div>

        {/* Top spending categories */}
        {topCategories.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard.topCategories', 'Top Categories')}
            </p>
            <div className="space-y-2">
              {topCategories.map((category, index) => (
                <div key={`${category.category}-${index}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {category.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(category.amount)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({category.percentage.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spending advice */}
        {isSpendingUp && spendingChangePercent > 10 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              💡 {t('dashboard.spendingAdvice', 'Your spending has increased. Consider reviewing your budget.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});