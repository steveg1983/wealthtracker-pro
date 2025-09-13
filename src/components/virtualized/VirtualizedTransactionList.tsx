/**
 * Virtualized Transaction List Component
 * Specialized list for displaying transactions with virtualization
 */

import React, { useEffect, memo, useCallback } from 'react';
import { VirtualizedList } from '../VirtualizedListSystem';
import { VirtualizedListService } from '../../services/virtualizedListService';
import type { Transaction } from '../../types';
import { logger } from '../../services/loggingService';

interface VirtualizedTransactionListProps {
  transactions: Transaction[];
  onTransactionClick?: (transaction: Transaction) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showCheckboxes?: boolean;
}

const TransactionRow = memo(function TransactionRow({
  transaction,
  isSelected,
  showCheckbox,
  onClick,
  onSelectionChange
}: {
  transaction: Transaction;
  isSelected: boolean;
  showCheckbox: boolean;
  onClick: () => void;
  onSelectionChange: (selected: boolean) => void;
}) {
  const amountDisplay = VirtualizedListService.formatTransactionAmount(transaction.amount);
  
  return (
    <div
      className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelectionChange(!isSelected);
            }}
            className="mr-3"
          />
        )}
        <div className="flex-1">
          <div className="font-medium text-gray-900 dark:text-white">
            {transaction.description}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {transaction.date.toLocaleDateString()} • {transaction.category}
          </div>
        </div>
        <div className={`font-semibold ${amountDisplay.className}`}>
          {amountDisplay.text}
        </div>
      </div>
    </div>
  );
});

const TransactionSkeleton = memo(() => (
  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
  </div>
));

const TransactionEmptyState = memo(() => (
  <div className="p-8 text-center text-gray-500">
    No transactions found
  </div>
));

export const VirtualizedTransactionList = memo(function VirtualizedTransactionList({
  transactions,
  onTransactionClick,
  selectedIds = [],
  onSelectionChange,
  showCheckboxes = false
}: VirtualizedTransactionListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('VirtualizedTransactionList component initialized', {
      componentName: 'VirtualizedTransactionList'
    });
  }, []);

  const config = VirtualizedListService.getTransactionConfig();
  
  const renderTransaction = useCallback((transaction: Transaction, index: number, isScrolling?: boolean) => {
    if (isScrolling) {
      return <TransactionSkeleton />;
    }

    return (
      <TransactionRow
        transaction={transaction}
        isSelected={selectedIds.includes(transaction.id)}
        showCheckbox={showCheckboxes}
        onClick={() => onTransactionClick?.(transaction)}
        onSelectionChange={(selected) => {
          const newSelection = VirtualizedListService.handleTransactionSelection(
            transaction.id,
            selectedIds,
            selected
          );
          onSelectionChange?.(newSelection);
        }}
      />
    );
  }, [selectedIds, onTransactionClick, onSelectionChange, showCheckboxes]);

  return (
    <VirtualizedList
      items={transactions}
      renderItem={renderTransaction}
      itemHeight={config.itemHeight}
      overscan={config.overscan}
      className="h-full"
      emptyState={<TransactionEmptyState />}
    />
  );
});