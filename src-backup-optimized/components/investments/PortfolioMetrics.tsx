import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, TrendingDownIcon, BarChart3Icon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface PortfolioMetricsProps {
  portfolioValue: number;
  totalInvested: number;
  totalReturn: number;
  returnPercentage: number;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
}

export const PortfolioMetrics = memo(function PortfolioMetrics({ portfolioValue,
  totalInvested,
  totalReturn,
  returnPercentage,
  formatCurrency,
  formatPercentage
 }: PortfolioMetricsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PortfolioMetrics component initialized', {
      componentName: 'PortfolioMetrics'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Value */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Portfolio Value</span>
          <BarChart3Icon className="text-blue-500" size={20} />
        </div>
        <div className="text-2xl font-bold text-theme-heading dark:text-white">
          {formatCurrency(portfolioValue)}
        </div>
      </div>

      {/* Total Invested */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Invested</span>
          <BarChart3Icon className="text-gray-500" size={20} />
        </div>
        <div className="text-2xl font-bold text-theme-heading dark:text-white">
          {formatCurrency(totalInvested)}
        </div>
      </div>

      {/* Total Return */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Return</span>
          {totalReturn >= 0 ? (
            <TrendingUpIcon className="text-green-500" size={20} />
          ) : (
            <TrendingDownIcon className="text-red-500" size={20} />
          )}
        </div>
        <div className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {totalReturn >= 0 ? '+' : ''}{formatCurrency(Math.abs(totalReturn))}
        </div>
      </div>

      {/* Return Percentage */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Return %</span>
          {returnPercentage >= 0 ? (
            <TrendingUpIcon className="text-green-500" size={20} />
          ) : (
            <TrendingDownIcon className="text-red-500" size={20} />
          )}
        </div>
        <div className={`text-2xl font-bold ${returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {returnPercentage >= 0 ? '+' : ''}{formatPercentage(Math.abs(returnPercentage))}
        </div>
      </div>
    </div>
  );
});