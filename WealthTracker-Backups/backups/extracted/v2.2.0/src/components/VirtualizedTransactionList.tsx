import React, { memo, useCallback, useRef, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { EditIcon, DeleteIcon, CheckIcon, XIcon } from './icons';
import type { Transaction } from '../types';
import { useFormattedDate } from '../hooks/useFormattedValues';

interface VirtualizedTransactionListProps {
  transactions: Transaction[];
  formatCurrency: (value: number) => string;
  onTransactionClick?: (transaction: Transaction) => void;
  onTransactionEdit?: (transaction: Transaction) => void;
  onTransactionDelete?: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  selectedTransactions?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  showBulkActions?: boolean;
}

interface TransactionRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    transactions: Transaction[];
    formatCurrency: (value: number) => string;
    onTransactionClick?: (transaction: Transaction) => void;
    onTransactionEdit?: (transaction: Transaction) => void;
    onTransactionDelete?: (id: string) => void;
    selectedTransactions?: Set<string>;
    onSelectionChange?: (selected: Set<string>) => void;
    showBulkActions?: boolean;
  };
}

// Memoized sub-components
const PendingBadge = memo((): React.JSX.Element => (
  <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
    Pending
  </span>
));
PendingBadge.displayName = 'PendingBadge';

const ReconcileIcon = memo(({ isCleared }: { isCleared: boolean }): React.JSX.Element => 
  isCleared ? (
    <CheckIcon size={16} className="text-green-600" />
  ) : (
    <XIcon size={16} className="text-gray-400" />
  )
);
ReconcileIcon.displayName = 'ReconcileIcon';

// Separate component for transaction date formatting
const TransactionDate = memo(({ date }: { date: Date }): React.JSX.Element => {
  const formattedDate = useFormattedDate(date);
  return <span>{formattedDate}</span>;
});
TransactionDate.displayName = 'TransactionDate';

// Memoized transaction row component
const TransactionRow = memo(({ index, style, data }: TransactionRowProps): React.JSX.Element | null => {
  const {
    transactions,
    formatCurrency,
    onTransactionClick,
    onTransactionEdit,
    onTransactionDelete,
    selectedTransactions,
    onSelectionChange,
    showBulkActions
  } = data;

  const transaction = transactions[index];
  
  // All hooks must be called at the top level, before any early returns
  const isSelected = selectedTransactions?.has(transaction?.id) || false;
  
  // Memoize amount formatting and color
  const { formattedAmount, amountClass } = useMemo(() => {
    if (!transaction) {
      return { formattedAmount: '', amountClass: '' };
    }
    // Determine if this is an expense/outgoing transfer or income/incoming transfer
    const isExpense = transaction.type === 'expense' || (transaction.type === 'transfer' && transaction.amount < 0);
    const isIncome = transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0);
    
    // Format amount with proper sign
    const displayAmount = isExpense ? -Math.abs(transaction.amount) : Math.abs(transaction.amount);
    const formatted = formatCurrency(displayAmount);
    
    // Add + prefix for income/incoming transfers if not already present
    const finalFormatted = isIncome && !formatted.startsWith('+') && !formatted.startsWith('-') 
      ? `+${formatted}` 
      : formatted;
    
    return {
      formattedAmount: finalFormatted,
      amountClass: isExpense ? 'text-red-600' : 'text-green-600'
    };
  }, [transaction, formatCurrency]);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!transaction) return;
    e.stopPropagation();
    if (onSelectionChange && selectedTransactions) {
      const newSelected = new Set(selectedTransactions);
      if (e.target.checked) {
        newSelected.add(transaction.id);
      } else {
        newSelected.delete(transaction.id);
      }
      onSelectionChange(newSelected);
    }
  }, [onSelectionChange, selectedTransactions, transaction]);

  const handleRowClick = useCallback(() => {
    if (!transaction) return;
    if (onTransactionClick) {
      onTransactionClick(transaction);
    }
  }, [onTransactionClick, transaction]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    if (!transaction) return;
    e.stopPropagation();
    if (onTransactionEdit) {
      onTransactionEdit(transaction);
    }
  }, [onTransactionEdit, transaction]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    if (!transaction) return;
    e.stopPropagation();
    if (onTransactionDelete && confirm('Are you sure you want to delete this transaction?')) {
      onTransactionDelete(transaction.id);
    }
  }, [onTransactionDelete, transaction]);

  const rowClassName = useMemo(() => {
    const base = 'flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer';
    return isSelected ? `${base} bg-blue-50 dark:bg-blue-900/20` : base;
  }, [isSelected]);

  // Early return after all hooks have been called
  if (!transaction) return null;

  return (
    <div
      style={style}
      className={rowClassName}
      onClick={handleRowClick}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowClick();
        }
      }}
      aria-label={`Transaction: ${transaction.description}, ${formattedAmount} on ${new Date(transaction.date).toLocaleDateString()}`}
    >
      {showBulkActions && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          className="mr-3 rounded"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select transaction ${transaction.description}`}
        />
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <p className="font-medium text-sm truncate">{transaction.description}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <TransactionDate date={transaction.date} /> • {transaction.category}
              {transaction.accountId && ` • ${transaction.accountId}`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`font-semibold whitespace-nowrap ${amountClass}`}>
              {formattedAmount}
            </span>
            
            {transaction.pending && <PendingBadge />}
            
            <ReconcileIcon isCleared={transaction.cleared || false} />
            
            <div className="flex items-center gap-1 ml-2">
              {onTransactionEdit && (
                <button
                  onClick={handleEdit}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Edit transaction"
                  aria-label={`Edit transaction ${transaction.description}`}
                >
                  <EditIcon size={16} />
                </button>
              )}
              
              {onTransactionDelete && (
                <button
                  onClick={handleDelete}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
                  title="Delete transaction"
                  aria-label={`Delete transaction ${transaction.description}`}
                >
                  <DeleteIcon size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to avoid unnecessary re-renders
  const prevTransaction = prevProps.data.transactions[prevProps.index];
  const nextTransaction = nextProps.data.transactions[nextProps.index];
  
  return (
    prevProps.index === nextProps.index &&
    prevProps.style === nextProps.style &&
    prevTransaction?.id === nextTransaction?.id &&
    prevTransaction?.amount === nextTransaction?.amount &&
    prevTransaction?.description === nextTransaction?.description &&
    prevTransaction?.category === nextTransaction?.category &&
    prevTransaction?.cleared === nextTransaction?.cleared &&
    prevProps.data.selectedTransactions?.has(prevTransaction?.id) === 
      nextProps.data.selectedTransactions?.has(nextTransaction?.id)
  );
});

TransactionRow.displayName = 'TransactionRow';

export const VirtualizedTransactionList = memo(function VirtualizedTransactionList({
  transactions,
  formatCurrency,
  onTransactionClick,
  onTransactionEdit,
  onTransactionDelete,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  selectedTransactions,
  onSelectionChange,
  showBulkActions = false
}: VirtualizedTransactionListProps): React.JSX.Element {
  const listRef = useRef<List>(null);

  // Memoize item data to prevent re-renders
  const itemData = useMemo(() => ({
    transactions,
    formatCurrency,
    onTransactionClick,
    onTransactionEdit,
    onTransactionDelete,
    selectedTransactions,
    onSelectionChange,
    showBulkActions
  }), [
    transactions,
    formatCurrency,
    onTransactionClick,
    onTransactionEdit,
    onTransactionDelete,
    selectedTransactions,
    onSelectionChange,
    showBulkActions
  ]);

  // Determine if an item is loaded
  const isItemLoaded = useCallback((index: number) => {
    return !hasMore || index < transactions.length;
  }, [hasMore, transactions.length]);

  // Load more items
  const loadMoreItems = useCallback(() => {
    if (isLoading || !onLoadMore) return Promise.resolve();
    onLoadMore();
    return Promise.resolve();
  }, [isLoading, onLoadMore]);

  // Calculate item count
  const itemCount = hasMore ? transactions.length + 1 : transactions.length;

  // Memoize row height
  const rowHeight = 80;

  return (
    <div className="flex-1 w-full" role="grid" aria-label="Transactions list" aria-rowcount={transactions.length}>
      <AutoSizer>
        {({ height, width }) => (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered, ref }) => (
              <List
                ref={(list) => {
                  // Handle both refs
                  if (list) {
                    listRef.current = list;
                    if (typeof ref === 'function') {
                      ref(list);
                    } else if (ref) {
                      ref.current = list;
                    }
                  }
                }}
                height={height}
                itemCount={itemCount}
                itemSize={rowHeight}
                itemData={itemData}
                onItemsRendered={onItemsRendered}
                width={width}
                overscanCount={5}
              >
                {TransactionRow}
              </List>
            )}
          </InfiniteLoader>
        )}
      </AutoSizer>
    </div>
  );
});

VirtualizedTransactionList.displayName = 'VirtualizedTransactionList';