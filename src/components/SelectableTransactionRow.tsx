import React, { memo, useCallback } from 'react';
import { TransactionRow } from './TransactionRow';
import type { Transaction, Account } from '../types';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

interface SelectableTransactionRowProps {
  transaction: Transaction;
  account: Account | undefined;
  isSelected: boolean;
  onToggleSelect: (transactionId: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onView: (transaction: Transaction) => void;
  selectionMode: boolean;
  displayCurrency: string;
  isCompact?: boolean;
}

export const SelectableTransactionRow = memo(function SelectableTransactionRow({
  transaction,
  account,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onView,
  selectionMode,
  displayCurrency,
  isCompact = false
}: SelectableTransactionRowProps): React.JSX.Element {
  const { formatCurrency: formatCurrencyDecimal } = useCurrencyDecimal();

  const formatCurrencyForRow = useCallback(
    (amount: number, currency?: string) => {
      return formatCurrencyDecimal(amount, currency || displayCurrency);
    },
    [displayCurrency, formatCurrencyDecimal]
  );

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't toggle selection if clicking on action buttons
    if ((e.target as HTMLElement).closest('[data-action-button]')) {
      return;
    }
    
    if (selectionMode) {
      e.preventDefault();
      onToggleSelect(transaction.id);
    }
  };

  return (
    <div 
      className={`relative ${selectionMode ? 'cursor-pointer' : ''}`}
      onClick={handleRowClick}
    >
      {/* Selection Checkbox */}
      {selectionMode && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(transaction.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            aria-label={`Select transaction ${transaction.description}`}
          />
        </div>
      )}
      
      {/* Transaction Row */}
      <div className={`${selectionMode ? 'pl-10' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
        <TransactionRow
          transaction={transaction}
          account={account}
          categoryPath={transaction.category}
          compactView={isCompact}
          formatCurrency={formatCurrencyForRow}
          onEdit={onEdit}
          onDelete={(_id) => onDelete(transaction)}
          onView={onView}
          columnOrder={['date', 'description', 'category', 'amount']}
          columnWidths={{ date: 100, description: 200, category: 150, amount: 100 }}
        />
      </div>
    </div>
  );
});

// Table header with select all checkbox
interface SelectableTransactionHeaderProps {
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  onToggleSelectAll: () => void;
  selectionMode: boolean;
}

export function SelectableTransactionHeader({
  isAllSelected,
  isPartiallySelected,
  onToggleSelectAll,
  selectionMode
}: SelectableTransactionHeaderProps): React.JSX.Element | null {
  if (!selectionMode) return null;

  return (
    <th className="w-10 px-2">
      <input
        type="checkbox"
        checked={isAllSelected}
        ref={input => {
          if (input) {
            input.indeterminate = isPartiallySelected;
          }
        }}
        onChange={onToggleSelectAll}
        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        aria-label="Select all transactions"
      />
    </th>
  );
}
