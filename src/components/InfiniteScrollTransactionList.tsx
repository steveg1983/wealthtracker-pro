import React, { useState, useEffect, useCallback, useMemo, useRef, memo, type ReactNode } from 'react';
import { SwipeableTransactionRow } from './SwipeableTransactionRow';
import type { Transaction, Account, Category } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { TableSkeleton, type TableSkeletonColumn } from './loading/TableSkeleton';
import { useDelayedFlag } from '../hooks/useDelayedFlag';

/**
 * What a transaction card is shaped like, for the placeholder that waits in
 * its place (DESIGN_PASS §4): `p-4` around a description line over a
 * date-and-category line, with the amount right-aligned.
 */
const CARD_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { key: 'description', className: 'flex-1' },
  { key: 'amount', width: '6rem' },
];

/** `p-4` over the card's two lines — measured at 375px in the running app. */
const CARD_HEIGHT = 77;

interface InfiniteScrollTransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  formatCurrency: (amount: number) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onView: (transaction: Transaction) => void;
  selectedTransactions?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  isLoading?: boolean;
  /**
   * What stands where the cards would be when there are none.
   *
   * REQUIRED, unlike VirtualizedTable's optional one, and that is the point.
   * This list used to answer every kind of nothing with a single sentence —
   * "No transactions found / Try adjusting your filters or add some
   * transactions" — which is the exact conflation DESIGN_PASS §4 forbids: it
   * tells somebody whose register is empty to adjust filters they have not
   * set, and somebody whose filter is hiding 1,284 rows that they have none.
   * The caller knows which of the two it is; a phone that could forget to say
   * is a phone that will.
   */
  emptyContent: ReactNode;
  itemsPerBatch?: number;
  /**
   * Should rows that have arrived and not been dealt with be drawn as new?
   *
   * Passed through to each card, off by default. See the prop's own note on
   * SwipeableTransactionRow: the mark belongs where the To Review counter and
   * its filter are, which is the account register, and nowhere else.
   */
  markNewArrivals?: boolean;
  /**
   * Which END of the list is the one worth opening on.
   *
   * `'start'` is the ordinary answer and the default: the first row is the one
   * you want, so the list opens at the top and older rows arrive as you scroll
   * down.
   *
   * `'end'` is for a register ordered oldest-first, which is how a ledger and
   * Microsoft Money both read: the NEWEST line is the last one, and that is
   * the line you want when the account opens. The desktop register has always
   * done this by scrolling to the foot. The phone could not, because a list
   * that loads downward from the top has no foot to scroll to — so the owner
   * choosing "Date — oldest first" landed on 2008 and would have scrolled
   * through eleven thousand rows to reach this month (29 Aug).
   *
   * With `'end'` the batches are taken from the BOTTOM and grow upward, so the
   * newest is on screen immediately and older rows arrive as you scroll up.
   */
  anchor?: 'start' | 'end';
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
  categories,
  formatCurrency,
  onEdit,
  onDelete,
  onView,
  selectedTransactions,
  onSelectionChange,
  isLoading = false,
  emptyContent,
  itemsPerBatch = 20,
  markNewArrivals = false,
  anchor = 'start'
  // `| null` is the 200ms rule in the type: a load too short to be worth
  // explaining renders NOTHING, which is not an element.
}: InfiniteScrollTransactionListProps): React.JSX.Element | null {
  const [displayedItems, setDisplayedItems] = useState(itemsPerBatch);
  const categoryNameById = useMemo(
    () => new Map(categories.map(c => [c.id, c.name])),
    [categories]
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /** Under 200ms the phone shows nothing rather than a flash of grey bars. */
  const showSkeleton = useDelayedFlag(isLoading && transactions.length === 0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  /**
   * Growing UPWARD moves everything already on screen down by the height of
   * whatever was added, so the reader is thrown backwards mid-scroll unless
   * the position is corrected. The document's height before the batch is what
   * that correction is measured against.
   */
  const containerRef = useRef<HTMLDivElement>(null);
  const heightBeforeGrowth = useRef<number | null>(null);
  const openedAtEnd = useRef(false);

  const loadMoreItems = useCallback(() => {
    setIsLoadingMore(true);
    if (anchor === 'end') {
      heightBeforeGrowth.current = document.body.scrollHeight;
    }
    
    // Simulate network delay for smooth UX
    setTimeout(() => {
      setDisplayedItems(prev => Math.min(prev + itemsPerBatch, transactions.length));
      setIsLoadingMore(false);
    }, 300);
  }, [anchor, itemsPerBatch, transactions.length]);

  // Reset displayed items when transactions change (e.g., filtering)
  useEffect(() => {
    setDisplayedItems(itemsPerBatch);
    openedAtEnd.current = false;
  }, [transactions, itemsPerBatch]);

  // ── Opening on the newest, and staying put while older rows arrive ────────
  //
  // Two different jobs, both only for an end-anchored list:
  //
  //   * ONCE, when the rows first exist, put the newest on screen. The desktop
  //     register does the same thing by scrolling to its foot.
  //   * EVERY TIME a batch is prepended, undo the jump it causes. Rows added
  //     above the viewport push the content down by exactly their height, so
  //     the reader's place is restored by scrolling down by the difference in
  //     document height. Without it, reading backwards through a year would
  //     throw you forwards every twenty rows.
  useEffect(() => {
    if (anchor !== 'end' || transactions.length === 0) return;

    // BOTH frames are cancelled on the way out. A frame that outlives its
    // component is not a tidiness problem: it runs after the reader has
    // navigated somewhere else and scrolls THAT page instead, and under a test
    // runner it reaches for a `window` that has already been torn down —
    // which is how this was caught rather than shipped.
    let frame = 0;

    if (!openedAtEnd.current) {
      openedAtEnd.current = true;
      // After paint, or the height being scrolled to is the height before the
      // rows were in it.
      frame = requestAnimationFrame(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
      });
      return () => cancelAnimationFrame(frame);
    }

    const before = heightBeforeGrowth.current;
    if (before === null) return;
    heightBeforeGrowth.current = null;
    frame = requestAnimationFrame(() => {
      const grew = document.body.scrollHeight - before;
      if (grew > 0) window.scrollBy({ top: grew, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, displayedItems, transactions.length]);

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

  // SHAPE, NOT SPINNER, and no pulsing (DESIGN_PASS §4). This was five cards
  // at a height no card has, breathing — on the one device where a repaint of
  // every visible row costs the most.
  if (isLoading && transactions.length === 0) {
    return showSkeleton
      ? <TableSkeleton columns={CARD_SKELETON_COLUMNS} rowHeight={CARD_HEIGHT} />
      : null;
  }

  // Whose nothing this is — an empty register or a filter hiding all of it —
  // is the caller's to say, and it always says.
  if (transactions.length === 0) {
    return <>{emptyContent}</>;
  }

  // End-anchored takes its batch from the bottom, so the newest rows are the
  // ones that exist first and older ones are added above them.
  const visibleTransactions = anchor === 'end'
    ? transactions.slice(Math.max(0, transactions.length - displayedItems))
    : transactions.slice(0, displayedItems);
  const hasMore = displayedItems < transactions.length;

  /*
   * The sentinel sits at whichever end the NEXT batch will come from — the
   * bottom when the list grows downward, the top when it grows upward. Left at
   * the bottom of an end-anchored list it would sit next to rows that are
   * already the last ones there are, and never come into view.
   */
  const loadMoreTrigger = hasMore ? (
    <div ref={loadMoreRef} className="py-8 flex justify-center">
      {isLoadingMore ? (
        <div className="flex flex-col items-center gap-2">
          <LoadingSpinner size="sm" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading {anchor === 'end' ? 'earlier' : 'more'} transactions...
          </p>
        </div>
      ) : (
        <button
          onClick={loadMoreItems}
          className="px-4 py-2 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          {anchor === 'end' ? 'Load earlier' : 'Load More'}
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="relative" ref={containerRef}>
      {/* Transaction count indicator */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {visibleTransactions.length} of {transactions.length} transactions
        </p>
      </div>

      {anchor === 'end' && loadMoreTrigger}

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
              categoryName={transaction.category ? categoryNameById.get(transaction.category) : undefined}
              formatCurrency={formatCurrency}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              isSelected={isSelected}
              onToggleSelection={onSelectionChange ? handleToggleSelection : undefined}
              markNewArrivals={markNewArrivals}
            />
          );
        })}
      </div>

      {anchor === 'start' && loadMoreTrigger}

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
          className="fixed z-20 p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          style={{ right: '1rem', bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
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
