import React, { useEffect, memo } from 'react';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  ActivityIcon,
  ShieldIcon,
  TargetIcon
} from '../icons';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';

export interface PortfolioMetrics {
  totalValue: DecimalInstance;
  totalCost: DecimalInstance;
  totalGain: DecimalInstance;
  totalGainPercent: number;
  dayChange: DecimalInstance;
  dayChangePercent: number;
  beta: number;
  sharpeRatio: number;
  volatility: number;
  diversificationScore: number;
}

interface PortfolioMetricsCardProps {
  metrics: PortfolioMetrics | null;
  formatCurrency: (value: DecimalInstance | number) => string;
  isAnalyzing: boolean;
}

export const PortfolioMetricsCard = memo(function PortfolioMetricsCard({
  metrics,
  formatCurrency,
  isAnalyzing
}: PortfolioMetricsCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PortfolioMetricsCard component initialized', {
      componentName: 'PortfolioMetricsCard'
    });
  }, []);

  const getDiversificationColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (!metrics && !isAnalyzing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          No portfolio data available. Add investment accounts to analyze.
        </p>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Analyzing portfolio...</span>
        </div>
      </div>
    );
  }

  if (!metrics) return <></>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Value */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Portfolio Value</span>
          <ActivityIcon className="text-blue-500" size={20} />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(metrics.totalValue)}
        </div>
        <div className="flex items-center mt-2">
          {metrics.dayChangePercent >= 0 ? (
            <TrendingUpIcon className="text-green-500 mr-1" size={16} />
          ) : (
            <TrendingDownIcon className="text-red-500 mr-1" size={16} />
          )}
          <span className={`text-sm ${
            metrics.dayChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(metrics.dayChange)} ({metrics.dayChangePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Total Gain/Loss */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total Return</span>
          {metrics.totalGainPercent >= 0 ? (
            <TrendingUpIcon className="text-green-500" size={20} />
          ) : (
            <TrendingDownIcon className="text-red-500" size={20} />
          )}
        </div>
        <div className={`text-2xl font-bold ${
          metrics.totalGainPercent >= 0 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400'
        }`}>
          {formatCurrency(metrics.totalGain)}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {metrics.totalGainPercent >= 0 ? '+' : ''}{metrics.totalGainPercent.toFixed(2)}% all-time
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Risk Profile</span>
          <ShieldIcon className="text-purple-500" size={20} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Beta</span>
            <span className="text-xs font-medium">{metrics.beta.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Sharpe</span>
            <span className="text-xs font-medium">{metrics.sharpeRatio.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Volatility</span>
            <span className="text-xs font-medium">{metrics.volatility.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Diversification */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Diversification</span>
          <TargetIcon className="text-indigo-500" size={20} />
        </div>
        <div className="flex items-center">
          <div className={`text-3xl font-bold ${getDiversificationColor(metrics.diversificationScore)}`}>
            {metrics.diversificationScore}
          </div>
          <span className="text-sm text-gray-500 ml-2">/100</span>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          {metrics.diversificationScore >= 80 ? 'Well diversified' :
           metrics.diversificationScore >= 60 ? 'Moderately diversified' : 
           'Needs improvement'}
        </div>
      </div>
    </div>
  );
});