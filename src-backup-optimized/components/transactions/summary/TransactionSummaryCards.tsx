import React, { useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon, CalendarIcon } from '../../icons';
import type { DecimalInstance } from '../../../types/decimal-types';
import { useLogger } from '../services/ServiceProvider';

interface TransactionSummaryCardsProps {
  income: DecimalInstance;
  expense: DecimalInstance;
  net: DecimalInstance;
  formatCurrency: (value: DecimalInstance, currency: string) => string;
  displayCurrency: string;
  t: (key: string, fallback?: string) => string;
}

export function TransactionSummaryCards({ income,
  expense,
  net,
  formatCurrency,
  displayCurrency,
  t
 }: TransactionSummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{t('transactions.income')}</p>
            <p className="text-lg md:text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(income, displayCurrency)}
            </p>
          </div>
          <TrendingUpIcon className="text-green-500" size={20} />
        </div>
      </div>
      
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{t('transactions.expenses')}</p>
            <p className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(expense, displayCurrency)}
            </p>
          </div>
          <TrendingDownIcon className="text-red-500" size={20} />
        </div>
      </div>
      
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{t('transactions.net', 'Net')}</p>
            <p className={`text-lg md:text-xl font-bold ${
              net.greaterThanOrEqualTo(0) 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(net, displayCurrency)}
            </p>
          </div>
          <CalendarIcon className="text-primary" size={20} />
        </div>
      </div>
    </div>
  );
}