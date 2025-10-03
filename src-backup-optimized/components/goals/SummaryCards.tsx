import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import {
  TargetIcon,
  TrendingUpIcon,
  PiggyBankIcon,
  DollarSignIcon
} from '../icons';
import type { Goal } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface SummaryCardsProps {
  goals: Goal[];
  overallProgress: number;
  monthlySavingsRate: number;
}

export const SummaryCards = memo(function SummaryCards({ goals, 
  overallProgress, 
  monthlySavingsRate 
 }: SummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SummaryCards component initialized', {
      componentName: 'SummaryCards'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  const totalSaved = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Goals</h3>
          <TargetIcon size={20} className="text-gray-400" />
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{goals.length}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Active goals
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Progress</h3>
          <TrendingUpIcon size={20} className="text-gray-500" />
        </div>
        <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
          {overallProgress.toFixed(1)}%
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
          <div 
            className="bg-gray-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, overallProgress)}%` }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Saved</h3>
          <PiggyBankIcon size={20} className="text-green-500" />
        </div>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {formatCurrency(totalSaved)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Across all goals
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Savings</h3>
          <DollarSignIcon size={20} className="text-purple-500" />
        </div>
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {formatCurrency(monthlySavingsRate)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Available for goals
        </p>
      </div>
    </div>
  );
});