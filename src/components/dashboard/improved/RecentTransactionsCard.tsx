import { memo, useEffect } from 'react';
import { CreditCardIcon } from '../../icons';
import type { Transaction } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

interface RecentTransactionsCardProps {
  transactions: Transaction[];
  formatCurrency: (amount: number) => string;
  onViewAll: () => void;
}

/**
 * Recent transactions card component
 */
export const RecentTransactionsCard = memo(function RecentTransactionsCard({ transactions,
  formatCurrency,
  onViewAll
 }: RecentTransactionsCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RecentTransactionsCard component initialized', {
      componentName: 'RecentTransactionsCard'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <CreditCardIcon size={24} className="text-gray-500" />
        Recent Transactions
      </h3>
      <div className="space-y-1 overflow-auto" style={{ maxHeight: '400px' }}>
        {transactions.length > 0 ? (
          transactions.slice(0, 10).map(transaction => (
            <div 
              key={transaction.id} 
              className="flex items-center gap-2 sm:gap-3 py-2 sm:py-1.5 border-b dark:border-gray-700/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors rounded px-2 -mx-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-3 flex-1">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-400 w-4 text-center">
                    {transaction.cleared ? 'R' : 'N'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium dark:text-white truncate flex-1">
                  {transaction.description}
                </p>
              </div>
              <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${
                transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0)
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {transaction.type === 'expense' || (transaction.type === 'transfer' && transaction.amount < 0)
                  ? formatCurrency(-Math.abs(transaction.amount))
                  : `+${formatCurrency(Math.abs(transaction.amount))}`}
              </span>
            </div>
          ))
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-6">
            No transactions yet
          </p>
        )}
        {transactions.length > 10 && (
          <button 
            onClick={onViewAll}
            className="w-full mt-4 py-2 text-gray-600 dark:text-gray-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            View All Transactions →
          </button>
        )}
      </div>
    </div>
  );
});