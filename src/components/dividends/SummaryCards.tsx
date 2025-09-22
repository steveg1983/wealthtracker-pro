import React, { useEffect, memo } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import {
  DollarSignIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  PieChartIcon
} from '../icons';
import type { DividendSummary } from './types';
import { useLogger } from '../services/ServiceProvider';

interface SummaryCardsProps {
  summary: DividendSummary;
}

export const SummaryCards = memo(function SummaryCards({ summary  }: SummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SummaryCards component initialized', {
      componentName: 'SummaryCards'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Dividends</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalDividends.toNumber())}</p>
          </div>
          <DollarSignIcon size={32} className="text-green-600" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Tax Withheld</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalTaxWithheld.toNumber())}</p>
          </div>
          <AlertCircleIcon size={32} className="text-orange-600" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Projected Annual</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.projectedAnnual.toNumber())}</p>
          </div>
          <TrendingUpIcon size={32} className="text-gray-600" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Unique Stocks</p>
            <p className="text-2xl font-bold">{Object.keys(summary.bySymbol).length}</p>
          </div>
          <PieChartIcon size={32} className="text-purple-600" />
        </div>
      </div>
    </div>
  );
});