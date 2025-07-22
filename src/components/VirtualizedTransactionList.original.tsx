import React, { memo, useCallback, useRef, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { EditIcon, DeleteIcon, CheckIcon, XIcon } from './icons';
import type { Transaction } from '../types';

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

// Memoized transaction row component
const TransactionRow = memo(({ index, style, data }: TransactionRowProps) => {
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
  if (!transaction) return null;

  const isSelected = selectedTransactions?.has(transaction.id) || false;
  const isExpense = transaction.amount < 0;

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleRowClick = () => {
    if (onTransactionClick) {
      onTransactionClick(transaction);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTransactionEdit) {
      onTransactionEdit(transaction);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTransactionDelete && confirm('Are you sure you want to delete this transaction?')) {
      onTransactionDelete(transaction.id);
    }
  };

  return (
    <div
      style={style}
      className={`flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      onClick={handleRowClick}
    >
      {showBulkActions && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          className="mr-3 rounded"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <p className="font-medium text-sm truncate">{transaction.description}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {transaction.date.toLocaleDateString()} • {transaction.category}
              {transaction.accountId && ` • ${transaction.accountId}`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`font-semibold whitespace-nowrap ${
              isExpense ? 'text-red-600' : 'text-green-600'
            }`}>
              {formatCurrency(transaction.amount)}
            </span>
            
            {transaction.pending && (
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                Pending
              </span>
            )}
            
            {transaction.cleared ? (
              <CheckIcon size={16} className="text-green-600" />
            ) : (
              <XIcon size={16} className="text-gray-400" />
            )}
            
            <div className="flex items-center gap-1 ml-2">
              {onTransactionEdit && (
                <button
                  onClick={handleEdit}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Edit transaction"
                >
                  <EditIcon size={16} />
                </button>
              )}
              
              {onTransactionDelete && (
                <button
                  onClick={handleDelete}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
                  title="Delete transaction"
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
  // Custom comparison for better performance
  const prevTxn = prevProps.data.transactions[prevProps.index];
  const nextTxn = nextProps.data.transactions[nextProps.index];
  
  if (!prevTxn || !nextTxn) return false;
  
  const prevSelected = prevProps.data.selectedTransactions?.has(prevTxn.id) || false;
  const nextSelected = nextProps.data.selectedTransactions?.has(nextTxn.id) || false;
  
  return prevTxn.id === nextTxn.id &&
         prevTxn.amount === nextTxn.amount &&
         prevTxn.description === nextTxn.description &&
         prevTxn.cleared === nextTxn.cleared &&
         prevSelected === nextSelected &&
         prevProps.style === nextProps.style;
});

TransactionRow.displayName = 'TransactionRow';

export const VirtualizedTransactionList: React.FC<VirtualizedTransactionListProps> = ({
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
}) => {
  const listRef = useRef<List>(null);
  
  // Memoize the data object to prevent unnecessary re-renders
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

  // Item count including potential loading item
  const itemCount = hasMore ? transactions.length + 1 : transactions.length;

  // Check if an item is loaded
  const isItemLoaded = useCallback((index: number) => {
    return !hasMore || index < transactions.length;
  }, [hasMore, transactions.length]);

  // Load more items
  const loadMoreItems = useCallback(() => {
    if (isLoading || !onLoadMore) return Promise.resolve();
    onLoadMore();
    return Promise.resolve();
  }, [isLoading, onLoadMore]);

  // Render the list
  return (
    <div className="h-full w-full">
      <AutoSizer>
        {({ height, width }) => (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
            minimumBatchSize={10}
            threshold={5}
          >
            {({ onItemsRendered, ref }) => (
              <List
                ref={(list) => {
                  if (typeof ref === 'function') {
                    ref(list);
                  } else if (ref && ref.current !== undefined) {
                    ref.current = list;
                  }
                  listRef.current = list;
                }}
                height={height}
                itemCount={transactions.length}
                itemSize={72} // Height of each row
                width={width}
                onItemsRendered={onItemsRendered}
                itemData={itemData}
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
};

// Export memoized version
export default memo(VirtualizedTransactionList);