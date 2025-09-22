import React, { useEffect, memo } from 'react';
import { TrendingUpIcon, CalculatorIcon, CheckCircleIcon, AlertCircleIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { useLogger } from '../services/ServiceProvider';

interface BudgetSummaryCardsProps {
  totalIncome: number;
  allocated: number;
  approved: number;
  remaining: number;
}

export const BudgetSummaryCards = memo(function BudgetSummaryCards({ totalIncome,
  allocated,
  approved,
  remaining
 }: BudgetSummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetSummaryCards component initialized', {
      componentName: 'BudgetSummaryCards'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Income</p>
            <p className="text-2xl font-bold">{formatCurrency(totalIncome)}</p>
          </div>
          <TrendingUpIcon size={32} className="text-green-600" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Allocated</p>
            <p className="text-2xl font-bold">{formatCurrency(allocated)}</p>
            <p className="text-xs text-gray-500">
              {totalIncome > 0 ? ((allocated / totalIncome) * 100).toFixed(1) : '0'}%
            </p>
          </div>
          <CalculatorIcon size={32} className="text-gray-600" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Approved</p>
            <p className="text-2xl font-bold">{formatCurrency(approved)}</p>
            <p className="text-xs text-gray-500">
              {totalIncome > 0 ? ((approved / totalIncome) * 100).toFixed(1) : '0'}%
            </p>
          </div>
          <CheckCircleIcon size={32} className="text-green-600" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
            <p className={`text-2xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(remaining)}
            </p>
          </div>
          {remaining < 0 ? (
            <AlertCircleIcon size={32} className="text-red-600" />
          ) : (
            <CheckCircleIcon size={32} className="text-green-600" />
          )}
        </div>
      </div>
    </div>
  );
});