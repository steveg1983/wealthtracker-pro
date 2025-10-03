import React, { useEffect, memo } from 'react';
import { CalendarIcon, TagIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Transaction, Account } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface TransactionSelectionListProps {
  transactions: Transaction[];
  selectedIds: Set<string>;
  onToggleTransaction: (id: string) => void;
  accounts: Account[];
}

export const TransactionSelectionList = memo(function TransactionSelectionList({ transactions,
  selectedIds,
  onToggleTransaction,
  accounts
 }: TransactionSelectionListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TransactionSelectionList component initialized', {
      componentName: 'TransactionSelectionList'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="space-y-2">
      {transactions.map(transaction => {
        const tDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
        const account = accounts.find(a => a.id === transaction.accountId);
        
        return (
          <label
            key={transaction.id}
            className={`block p-3 rounded-lg border cursor-pointer transition-colors
                     ${selectedIds.has(transaction.id)
                       ? 'border-primary bg-primary/10'
                       : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                     }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(transaction.id)}
                onChange={() => onToggleTransaction(transaction.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{transaction.description}</div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarIcon size={14} />
                        {tDate.toLocaleDateString()}
                      </span>
                      <span>{transaction.category}</span>
                      <span>{account?.name}</span>
                      {transaction.tags && transaction.tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <TagIcon size={14} />
                          {transaction.tags.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`font-medium ${
                    transaction.type === 'income' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
});