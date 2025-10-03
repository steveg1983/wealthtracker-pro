import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { ArrowUpRightIcon, ArrowDownRightIcon, CreditCardIcon } from '../icons';

interface RecentTransactionsWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: Record<string, any>;
}

export default function RecentTransactionsWidget({ size, settings }: RecentTransactionsWidgetProps): React.JSX.Element {
  const { transactions, accounts, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const count = settings.count || 5;

  const recentTransactions = useMemo(() => {
    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, count)
      .map(transaction => {
        const account = accounts.find(a => a.id === transaction.accountId);
        const category = categories.find(c => c.id === transaction.category);
        return {
          ...transaction,
          accountName: account?.name || 'Unknown Account',
          categoryName: category?.name || 'Uncategorized'
        };
      });
  }, [transactions, accounts, categories, count]);

  if (size === 'small') {
    return (
      <div className="space-y-2">
        {recentTransactions.slice(0, 3).map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {transaction.type === 'income' ? (
                <ArrowDownRightIcon className="text-green-500" size={16} />
              ) : (
                <ArrowUpRightIcon className="text-red-500" size={16} />
              )}
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {transaction.description}
              </span>
            </div>
            <span className={`text-sm font-medium ${
              transaction.type === 'income' 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {transaction.type === 'expense' ? formatCurrency(-Math.abs(transaction.amount)) : `+${formatCurrency(Math.abs(transaction.amount))}`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-3">
        {recentTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className={`p-2 rounded-full ${
              transaction.type === 'income' 
                ? 'bg-green-100 dark:bg-green-900/20' 
                : 'bg-red-100 dark:bg-red-900/20'
            }`}>
              {transaction.type === 'income' ? (
                <ArrowDownRightIcon className="text-green-600 dark:text-green-400" size={16} />
              ) : (
                <ArrowUpRightIcon className="text-red-600 dark:text-red-400" size={16} />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">
                  {transaction.description}
                </h4>
                <span className={`font-semibold ${
                  transaction.type === 'income' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {transaction.type === 'expense' ? formatCurrency(-Math.abs(transaction.amount)) : `+${formatCurrency(Math.abs(transaction.amount))}`}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span>{transaction.categoryName}</span>
                <span>{new Date(transaction.date).toLocaleDateString()}</span>
              </div>
              
              {size === 'large' && (
                <div className="flex items-center gap-2 mt-2">
                  <CreditCardIcon size={12} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {transaction.accountName}
                  </span>
                  {transaction.cleared && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-2 py-1 rounded-full">
                      Cleared
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {recentTransactions.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No recent transactions
          </div>
        )}
      </div>
    </div>
  );
}