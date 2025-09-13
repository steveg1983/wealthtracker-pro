/**
 * Transaction Summary Component
 * Displays summary statistics for filtered transactions
 */

import React, { useEffect } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { logger } from '../../services/loggingService';

interface TransactionSummaryProps {
  summary: {
    count: number;
    total: number;
    average: number;
    income: number;
    expense: number;
  };
}

const TransactionSummary = React.memo(({ summary }: TransactionSummaryProps) => {
  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Count</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {summary.count}
        </p>
      </div>
      
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
        <p className={`text-lg font-semibold ${
          summary.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {formatCurrency(Math.abs(summary.total))}
        </p>
      </div>
      
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Average</p>
        <p className={`text-lg font-semibold ${
          summary.average >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {formatCurrency(Math.abs(summary.average))}
        </p>
      </div>
      
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Income</p>
        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
          {formatCurrency(summary.income)}
        </p>
      </div>
      
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
        <p className="text-lg font-semibold text-red-600 dark:text-red-400">
          {formatCurrency(summary.expense)}
        </p>
      </div>
    </div>
  );
});

TransactionSummary.displayName = 'TransactionSummary';

export default TransactionSummary;