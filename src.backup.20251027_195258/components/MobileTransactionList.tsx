import React, { memo, useCallback } from 'react';
import { SwipeableTransactionRow } from './SwipeableTransactionRow';
import type { Transaction, Account } from '../types';

interface MobileTransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  formatCurrency: (amount: number) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onView: (transaction: Transaction) => void;
  selectedTransactions?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  isLoading?: boolean;
}

export const MobileTransactionList = memo(function MobileTransactionList({
  transactions,
  accounts,
  formatCurrency,
  onEdit,
  onDelete,
  onView,
  selectedTransactions,
  onSelectionChange,
  isLoading = false
}: MobileTransactionListProps): React.JSX.Element {
  const handleToggleSelection = useCallback((id: string) => {
    if (!onSelectionChange || !selectedTransactions) return;
    
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  }, [selectedTransactions, onSelectionChange]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {transactions.map((transaction) => {
        const account = accounts.find(a => a.id === transaction.accountId);
        const isSelected = selectedTransactions?.has(transaction.id) || false;
        
        return (
          <SwipeableTransactionRow
            key={transaction.id}
            transaction={transaction}
            {...(account ? { account } : {})}
            formatCurrency={formatCurrency}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            isSelected={isSelected}
            {...(onSelectionChange ? { onToggleSelection: handleToggleSelection } : {})}
          />
        );
      })}
    </div>
  );
});
