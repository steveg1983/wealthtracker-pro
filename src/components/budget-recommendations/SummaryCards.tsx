import { memo, useEffect } from 'react';
import { PiggyBankIcon, AlertTriangleIcon, TrendingUpIcon, LightbulbIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface SummaryCardsProps {
  totalCategories: number;
  needsOptimization: number;
  potentialSavings: number;
  optimizationScore: number;
  formatCurrency: (amount: any) => string;
}

export const SummaryCards = memo(function SummaryCards({ totalCategories,
  needsOptimization,
  potentialSavings,
  optimizationScore,
  formatCurrency
 }: SummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SummaryCards component initialized', {
      componentName: 'SummaryCards'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Categories</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalCategories}
            </p>
          </div>
          <LightbulbIcon size={24} className="text-gray-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Need Optimization</p>
            <p className="text-2xl font-bold text-orange-600">
              {needsOptimization}
            </p>
          </div>
          <AlertTriangleIcon size={24} className="text-orange-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Potential Savings</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(potentialSavings)}
            </p>
          </div>
          <PiggyBankIcon size={24} className="text-green-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Optimization Score</p>
            <p className="text-2xl font-bold text-gray-600">
              {Math.round(optimizationScore * 100)}%
            </p>
          </div>
          <TrendingUpIcon size={24} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
});