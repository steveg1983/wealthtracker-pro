import React, { useEffect } from 'react';
import { TrendingDownIcon, CalculatorIcon, BarChart3Icon, TrendingUpIcon } from '../../icons';
import type { CreditScoreEntry } from '../../DebtManagement';
import type { DecimalInstance } from '../../../types/decimal-types';
import { logger } from '../../../services/loggingService';

interface DebtSummaryCardsProps {
  totalDebt: DecimalInstance;
  totalMinimumPayment: DecimalInstance;
  totalInterestRate: DecimalInstance;
  latestCreditScore: CreditScoreEntry | null;
  creditScoreChange: number;
  formatCurrency: (value: number) => string;
}

export function DebtSummaryCards({ 
  totalDebt, 
  totalMinimumPayment, 
  totalInterestRate, 
  latestCreditScore, 
  creditScoreChange, 
  formatCurrency 
}: DebtSummaryCardsProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Debt</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalDebt.toNumber())}
            </p>
          </div>
          <TrendingDownIcon className="text-red-500" size={24} />
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Payments</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(totalMinimumPayment.toNumber())}
            </p>
          </div>
          <CalculatorIcon className="text-orange-500" size={24} />
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Interest Rate</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalInterestRate.toFixed(2)}%
            </p>
          </div>
          <BarChart3Icon className="text-gray-500" size={24} />
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Credit Score</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {latestCreditScore ? latestCreditScore.score : 'N/A'}
            </p>
            {creditScoreChange !== 0 && (
              <p className={`text-xs ${creditScoreChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {creditScoreChange > 0 ? '+' : ''}{creditScoreChange}
              </p>
            )}
          </div>
          <TrendingUpIcon className="text-green-500" size={24} />
        </div>
      </div>
    </div>
  );
}
