import { memo } from 'react';
import type { Transaction, Account } from '../types';
import { TrendingUpIcon, TrendingDownIcon } from './icons';

interface TransactionCardProps {
  transaction: Transaction;
  account: Account | undefined;
  categoryDisplay: string;
  formatCurrency: (amount: number, currency?: string) => string;
  onClick: () => void;
}

export const TransactionCard = memo(function TransactionCard({
  transaction,
  account,
  categoryDisplay,
  formatCurrency,
  onClick
}: TransactionCardProps) {
  const getTypeIcon = (type: string) => {
    if (type === 'income' || (type === 'transfer' && transaction.amount > 0)) {
      return <TrendingUpIcon className="text-green-500" size={20} />;
    } else {
      return <TrendingDownIcon className="text-red-500" size={20} />;
    }
  };

  return (
    <div 
      className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg p-3 lg:p-4 cursor-pointer hover:shadow-xl transition-shadow border border-white/20 dark:border-gray-700/50"
      onClick={onClick}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-0.5">
            {getTypeIcon(transaction.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white text-sm lg:text-base truncate pr-2">
              {transaction.description}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                {new Date(transaction.date).toLocaleDateString()}
              </p>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                {transaction.cleared ? 'R' : 'N'}
              </span>
            </div>
          </div>
        </div>
        <span className={`font-bold text-sm lg:text-base flex-shrink-0 ${
          transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0) 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400'
        }`}>
          {transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0) ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount), account?.currency || 'GBP')}
        </span>
      </div>
      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 gap-2">
        <span className="truncate">{categoryDisplay}</span>
        <span className="flex-shrink-0">{account?.name || 'Unknown'}</span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.transaction.id === nextProps.transaction.id &&
    prevProps.transaction.cleared === nextProps.transaction.cleared &&
    prevProps.transaction.description === nextProps.transaction.description &&
    prevProps.transaction.amount === nextProps.transaction.amount &&
    prevProps.account?.id === nextProps.account?.id &&
    prevProps.categoryDisplay === nextProps.categoryDisplay
  );
});