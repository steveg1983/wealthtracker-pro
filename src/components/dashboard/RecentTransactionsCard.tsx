import React, { useEffect, memo } from 'react';
import { ClockIcon, ArrowUpIcon, ArrowDownIcon } from '../icons';
import type { Transaction } from '../../types';
import { logger } from '../../services/loggingService';

interface RecentTransactionsCardProps {
  transactions: Transaction[];
  formatCurrency: (value: number) => string;
  formatDate: (date: string | Date) => string;
  t: (key: string, defaultValue: string) => string;
  onNavigate?: () => void;
}

export const RecentTransactionsCard = memo(function RecentTransactionsCard({
  transactions,
  formatCurrency,
  formatDate,
  t,
  onNavigate
}: RecentTransactionsCardProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('RecentTransactionsCard component initialized', {
      componentName: 'RecentTransactionsCard'
    });
  }, []);

  if (transactions.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <ClockIcon size={20} className="text-gray-500" />
        {t('dashboard.recentTransactions', 'Recent Transactions')}
      </h3>

      <div className="space-y-3">
        {transactions.slice(0, 5).map(transaction => (
          <div 
            key={transaction.id}
            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                {transaction.description || transaction.merchant || t('dashboard.noDescription', 'No description')}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{formatDate(transaction.date)}</span>
                {transaction.categoryName && (
                  <>
                    <span>•</span>
                    <span>{transaction.categoryName}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {transaction.amount >= 0 ? (
                <ArrowUpIcon size={16} className="text-green-500" />
              ) : (
                <ArrowDownIcon size={16} className="text-red-500" />
              )}
              <span className={`font-semibold ${
                transaction.amount >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(Math.abs(transaction.amount))}
              </span>
            </div>
          </div>
        ))}
      </div>

      {transactions.length > 5 && onNavigate && (
        <button 
          onClick={onNavigate}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('dashboard.viewAllTransactions', 'View all transactions')} →
        </button>
      )}
    </div>
  );
});
