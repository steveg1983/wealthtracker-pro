import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { SwipeableTransactionRow } from './SwipeableTransactionRow';
import type { Transaction, Account } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

interface InfiniteScrollTransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  formatCurrency: (amount: number) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onView: (transaction: Transaction) => void;
  selectedTransactions?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  isLoading?: boolean;
  itemsPerBatch?: number;
}

/**
 * Mobile Transaction List with Infinite Scroll
 * Design principles:
 * 1. Load transactions in batches as user scrolls
 * 2. Smooth, seamless experience without pagination buttons
 * 3. Intersection Observer for performance
 * 4. Pull-to-refresh support (handled by parent)
 */
export const InfiniteScrollTransactionList = memo(function InfiniteScrollTransactionList({
  transactions,
  accounts,
  formatCurrency,
  onEdit,
  onDelete,
  onView,
  selectedTransactions,
  onSelectionChange,
  isLoading = false,
  itemsPerBatch = 20
}: InfiniteScrollTransactionListProps): React.JSX.Element {
  const [displayedItems, setDisplayedItems] = useState(itemsPerBatch);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMoreItems = useCallback(() => {
    setIsLoadingMore(true);
    
    // Simulate network delay for smooth UX
    setTimeout(() => {
      setDisplayedItems(prev => Math.min(prev + itemsPerBatch, transactions.length));
      setIsLoadingMore(false);
    }, 300);
  }, [itemsPerBatch, transactions.length]);

  // Reset displayed items when transactions change (e.g., filtering)
  useEffect(() => {
    setDisplayedItems(itemsPerBatch);
  }, [transactions, itemsPerBatch]);

  // Set up Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && displayedItems < transactions.length && !isLoadingMore) {
          loadMoreItems();
        }
      },
      {
        root: null,
        rootMargin: '100px', // Start loading 100px before reaching the end
        threshold: 0.1
      }
    );

    // Start observing
    observerRef.current.observe(loadMoreRef.current);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [displayedItems, isLoadingMore, loadMoreItems, transactions.length]);

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

  // Initial loading state
  if (isLoading && transactions.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg p-4 animate-pulse">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          Try adjusting your filters or add some transactions
        </p>
      </div>
    );
  }

  const visibleTransactions = transactions.slice(0, displayedItems);
  const hasMore = displayedItems < transactions.length;

  return (
    <div className="relative">
      {/* Transaction count indicator */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {visibleTransactions.length} of {transactions.length} transactions
        </p>
      </div>

      {/* Transaction list */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {visibleTransactions.map((transaction) => {
          const account = accounts.find(a => a.id === transaction.accountId);
          const isSelected = selectedTransactions?.has(transaction.id) || false;
          
          return (
            <SwipeableTransactionRow
              key={transaction.id}
              transaction={transaction}
              account={account}
              formatCurrency={formatCurrency}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              isSelected={isSelected}
              onToggleSelection={onSelectionChange ? handleToggleSelection : undefined}
            />
          );
        })}
      </div>

      {/* Load more trigger */}
      {hasMore && (
        <div 
          ref={loadMoreRef}
          className="py-8 flex justify-center"
        >
          {isLoadingMore ? (
            <div className="flex flex-col items-center gap-2">
              <LoadingSpinner size="sm" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading more transactions...
              </p>
            </div>
          ) : (
            <button
              onClick={loadMoreItems}
              className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Load More
            </button>
          )}
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && transactions.length > itemsPerBatch && (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            You've reached the end • {transactions.length} transactions total
          </p>
        </div>
      )}

      {/* Scroll to top button */}
      {visibleTransactions.length > 10 && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 right-4 z-20 p-3 bg-card-bg-light dark:bg-card-bg-dark rounded-full shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Scroll to top"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
});

export default InfiniteScrollTransactionList;
