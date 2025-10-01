import React, { memo, useCallback, useMemo } from 'react';
import { TransactionRow } from './TransactionRow';
import type { Transaction, Account } from '../types';
import { useApp } from '../contexts/AppContextSupabase';
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
  isCompact = false
}: SelectableTransactionRowProps): React.JSX.Element {
  const { categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const categoryPath = useMemo(() => {
    const visited = new Set<string>();
    const pathSegments: string[] = [];
    let current = categories.find(c => c.id === transaction.category);

    while (current && !visited.has(current.id)) {
      pathSegments.unshift(current.name);
      visited.add(current.id);
      if (!current.parentId) {
        break;
      }
      current = categories.find(c => c.id === current?.parentId);
    }

    return pathSegments.length > 0 ? pathSegments.join(' • ') : 'Uncategorized';
  }, [categories, transaction.category]);

  const columnOrder = useMemo(() => ['date', 'description', 'category', 'amount', 'actions'], []);

  const columnWidths = useMemo(() => ({
    date: 140,
    description: 260,
    category: 200,
    amount: 140,
    actions: 120,
    reconciled: 80,
    account: 160
  }), []);

  const toggleSelectionProps = useMemo(
    () => (selectionMode ? { onToggleSelection: onToggleSelect } : {}),
    [selectionMode, onToggleSelect]
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

  const handleDelete = useCallback(
    (id: string) => {
      if (id === transaction.id) {
        onDelete(transaction);
      }
    },
    [onDelete, transaction]
  );

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
            className="h-4 w-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500"
            aria-label={`Select transaction ${transaction.description}`}
          />
        </div>
      )}
      
      {/* Transaction Row */}
      <div className={`${selectionMode ? 'pl-10' : ''} ${isSelected ? 'bg-blue-50 dark:bg-gray-900/20' : ''}`}>
        <TransactionRow
          transaction={transaction}
          account={account}
          onEdit={onEdit}
          onDelete={handleDelete}
          onView={onView}
          compactView={isCompact}
          categoryPath={categoryPath}
          formatCurrency={formatCurrency}
          columnOrder={columnOrder}
          columnWidths={columnWidths}
          isSelected={isSelected}
          enableBulkSelection={selectionMode}
          {...toggleSelectionProps}
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
        className="h-4 w-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500"
        aria-label="Select all transactions"
      />
    </th>
  );
}
