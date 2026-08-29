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

/**
 * How many rows a jump towards the growing end takes on each frame.
 *
 * STRIDES, NOT ONE LEAP. Setting `displayedItems` straight to
 * `transactions.length` would render the owner's 1,842 cards in a single
 * synchronous pass and block the main thread for the whole of it — and a
 * blocked thread cannot honour the rule this pin is built around, that a
 * reader who grabs the page mid-flight wins. Ten batches a frame hands the
 * thread back between each stride, so the release listener still runs, each
 * stride is bounded work, and his register arrives in nine frames. The
 * ordinary path would have taken it in 86 batches behind a 300ms delay each:
 * twenty-six seconds of arriving.
 *
 * It is deliberately not a fraction of the total. A register of 11,000 rows
 * gets more strides rather than bigger ones, because the point of the number
 * is the size of one frame's work, not the length of the journey.
 */
const PINNED_BATCH_SIZE = 200;

/**
 * The keys that scroll a page, and so mean "I am steering now".
 *
 * Space is in here and is also how a button is activated — harmlessly, because
 * a button fires its click on the key UP, after this listener has already let
 * go of a pin that was not yet set.
 */
const SCROLL_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '
]);

/**
 * What the jump button tells a screen reader it does.
 *
 * "Top" and "bottom" are facts about a scrollbar; "newest" and "oldest" are
 * facts about the register, and they are what somebody is actually looking
 * for. The caller is the only one who can say which end is which — the phone
 * register reverses its own default order before handing the rows over — so
 * without that answer the label stays with the direction rather than guessing
 * a chronology a list sorted by amount does not have.
 */
const jumpLabelFor = (jumpTo: 'top' | 'bottom', newestEnd?: 'start' | 'end'): string => {
  if (newestEnd === undefined) {
    return jumpTo === 'top' ? 'Jump to the top of the list' : 'Jump to the bottom of the list';
  }
  const arrivingAt = jumpTo === 'top' ? 'start' : 'end';
  return arrivingAt === newestEnd ? 'Jump to newest' : 'Jump to oldest';
};

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
  markAwaitingReview?: boolean;
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
  /**
   * Which end of the list the NEWEST transaction sits at, if either does.
   *
   * Only the caller can know: it holds the sort, and on a phone the register
   * also reverses its own default before handing the rows over. Supplied, the
   * jump control names a destination a person recognises — "Jump to newest" —
   * instead of a direction they have to translate. Left out (a list sorted by
   * amount, where neither end is newest anything) it says top and bottom,
   * which is at least true.
   */
  newestEnd?: 'start' | 'end';
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
  markAwaitingReview = false,
  anchor = 'start',
  newestEnd
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

  // ── "TAKE ME TO THE END", AND MEANING THE TRUE ONE ───────────────────────
  //
  // Owner, 29 Aug, on the phone register (1,842 rows, 120 of them loaded):
  // "when I press the down arrow, the screen briefly shows me the bottom and
  // then ends up somewhere last year, and so I still have to continuously
  // scroll… the up arrow works perfectly."
  //
  // THE CASCADE. The jump scrolled to `document.body.scrollHeight`, which is
  // the foot of the rows that HAPPEN TO BE LOADED. Landing there brings the
  // load-more sentinel into view, the observer fires, twenty more rows render
  // BELOW the viewport — and the bottom he was just shown is now mid-list.
  // Each further batch does it again. The up arrow worked because the top of a
  // list that loads downward is a FIXED EDGE: nothing is ever added above it.
  //
  // So a jump towards the end the list GROWS FROM cannot be one scroll. It is
  // a promise, kept until it is true: pin the viewport to that end, re-scroll
  // after every stride, and let go only when there is nothing left to load —
  // at which point the reader is at the end there actually is.
  //
  // `growingEnd` is what makes the two directions one piece of code. A list
  // that loads downward grows at the bottom; an end-anchored register loading
  // "Load earlier" grows at the top and cascades identically when you jump up
  // it, so it gets the same promise rather than a mirrored copy of one.
  const growingEnd: 'top' | 'bottom' = anchor === 'end' ? 'top' : 'bottom';
  const [pinnedTo, setPinnedTo] = useState<'top' | 'bottom' | null>(null);

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
    // A filter is a new question, not a continuation of the journey somebody
    // was on: the end they asked for is not the end that exists now.
    setPinnedTo(null);
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

    // While a jump is pinned, the pin IS the scroll position. This correction
    // exists to put a reader back where a batch found them, which is precisely
    // what somebody who asked to be taken to the top is overriding — left in,
    // the two would fight every stride and the pin would lose.
    if (pinnedTo !== null) {
      heightBeforeGrowth.current = null;
      return;
    }

    const before = heightBeforeGrowth.current;
    if (before === null) return;
    heightBeforeGrowth.current = null;
    frame = requestAnimationFrame(() => {
      const grew = document.body.scrollHeight - before;
      if (grew > 0) window.scrollBy({ top: grew, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, displayedItems, transactions.length, pinnedTo]);

  // ── Getting from one end of a long register to the other ─────────────────
  //
  // Owner, 29 Aug: "I need a way to quickly get to the newest… whether a 'to
  // top' button that appears as you scroll up, or a 'To bottom' if you scroll
  // down, or some other way of quickly navigating from one end to the other in
  // mobile view." BOTH ends of this page are somewhere to be — Quick Add sits
  // under the last row, the filters sit above the first — and no thumb flicks
  // past eleven thousand rows to reach either.
  //
  // ONE control, always offering the FAR end: in the top half of the page it
  // goes down, in the bottom half it goes up. Where the viewport is has to be
  // MEASURED rather than remembered, because the page grows under the reader
  // every time a batch lands.
  //
  // `null` while the page is shorter than about two screens. A register whose
  // other end is a flick away does not need a shortcut to it, and a floating
  // button over four rows is clutter sitting on top of one of them.
  const [jumpTo, setJumpTo] = useState<'top' | 'bottom' | null>(null);
  useEffect(() => {
    // rAF-throttled: a listener that measures on every scroll event does its
    // layout reads at the precise moment the phone is busiest.
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const furthest = document.body.scrollHeight - window.innerHeight;
      if (furthest < window.innerHeight) {
        setJumpTo(null);
        return;
      }
      setJumpTo(window.scrollY < furthest / 2 ? 'bottom' : 'top');
    };
    const onScroll = (): void => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(measure);
    };
    measure();
    // Passive, because this listener never calls preventDefault — saying so is
    // what keeps it off the critical path of the scroll it is watching.
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // Re-measured whenever the list grows: a batch changes the page's height,
    // and with it whether there is a far end worth offering at all.
  }, [displayedItems, transactions.length]);

  // ── KEEPING THE PROMISE ──────────────────────────────────────────────────
  //
  // One frame of the flight: put the viewport on the pinned end, then take the
  // next stride — or, if there is no next stride, let go. The order inside the
  // frame is the invariant: the release happens AFTER the scroll that made it
  // true, so a pin never ends anywhere but at the true end.
  //
  // `behavior: 'auto'` rather than 'smooth' for the whole flight. A smooth
  // animation towards a target that moves every stride is exactly the thing
  // the owner described — "briefly shows me the bottom" — and cutting one
  // short every 16ms is a stutter, not a glide. The one-scroll case below
  // keeps its smoothness, because a fixed edge does not move.
  //
  // Driven by `displayedItems` rather than by the observer: the sentinel is
  // what caused the cascade, and a promise that depends on it coming back into
  // view is a promise made of the same material as the bug.
  useEffect(() => {
    if (pinnedTo === null) return;

    let frame = requestAnimationFrame(() => {
      frame = 0;
      window.scrollTo({
        top: pinnedTo === 'top' ? 0 : document.body.scrollHeight,
        behavior: 'auto'
      });
      if (displayedItems < transactions.length) {
        setDisplayedItems(prev => Math.min(prev + PINNED_BATCH_SIZE, transactions.length));
        return;
      }
      setPinnedTo(null);
    });

    // Cancelled on the way out, as every frame in this file is: one that
    // outlives its component scrolls whatever page replaced it.
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [pinnedTo, displayedItems, transactions.length]);

  // ── AND LETTING GO THE MOMENT SOMEBODY ELSE STEERS ───────────────────────
  //
  // A pin is a convenience, never a restraint. The reader reaching for the
  // page mid-flight wins immediately — on iOS the touch itself halts a scroll
  // in progress, so the stand-down has to be at the moment of CONTACT rather
  // than at the first movement, or the phone and the pin spend a frame
  // disagreeing about where the page is.
  //
  // Only real steering counts. `scroll` events are not in this list because
  // the pin's own scrolling raises them, and a pin that released itself would
  // be no pin at all.
  useEffect(() => {
    if (pinnedTo === null) return;

    const release = (): void => setPinnedTo(null);
    const releaseOnScrollKey = (event: KeyboardEvent): void => {
      if (SCROLL_KEYS.has(event.key)) setPinnedTo(null);
    };
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('keydown', releaseOnScrollKey);
    return () => {
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('keydown', releaseOnScrollKey);
    };
  }, [pinnedTo]);

  const handleJump = useCallback((): void => {
    if (jumpTo === null) return;

    // Towards the growing end, with rows still to load: a promise, not a
    // scroll. Everything already loaded and it is a fixed edge like any other.
    if (jumpTo === growingEnd && displayedItems < transactions.length) {
      setPinnedTo(jumpTo);
      return;
    }

    // A tap the other way replaces whatever was in flight — the reader has
    // changed their mind, and two destinations cannot both be honoured.
    setPinnedTo(null);
    window.scrollTo({
      top: jumpTo === 'top' ? 0 : document.body.scrollHeight,
      behavior: 'smooth'
    });
  }, [jumpTo, growingEnd, displayedItems, transactions.length]);

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
        // Not while a jump is pinned: the pin is already loading, faster and
        // without the 300ms courtesy delay, and two loaders would step over
        // each other's `heightBeforeGrowth` on an end-anchored list.
        if (
          entry.isIntersecting
          && displayedItems < transactions.length
          && !isLoadingMore
          && pinnedTo === null
        ) {
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
  }, [displayedItems, isLoadingMore, loadMoreItems, transactions.length, pinnedTo]);

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
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
              markAwaitingReview={markAwaitingReview}
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

      {/*
        THE FAR END, one tap away — replacing a button that only ever went to
        the top. Two floating controls would have been two things to aim at
        with the same thumb, and one of them would always be offering the end
        you are already standing on.
        ─────────────────────────────────────────────────────────────────────
        WHAT A JUMP CAN HONESTLY REACH — and, since 29 August, it reaches the
        END. It used to scroll to the foot of the rows that happened to be
        loaded, which the arrival itself then invalidated by loading more
        beneath it; a jump towards the growing end is now a pin that keeps
        re-arriving until the whole register is in the page. See the pin above
        for what that costs and why the reader can always take it back.
        ─────────────────────────────────────────────────────────────────────
        It keeps the old button's place in the corner — clear of the floating
        nav pill, which starts at `calc(0.75rem + safe-area)` — and its 44px:
        `p-3` around a 20px icon is exactly that, and the `min-*` pair says so
        outright rather than leaving it to arithmetic somebody has to redo.
        Phone-only comes from the ancestor: the register mounts this list
        inside an `lg:hidden` panel, so a desktop never paints the button.
      */}
      {jumpTo && (
        <button
          onClick={handleJump}
          className="fixed z-20 flex items-center justify-center min-w-[44px] min-h-[44px] p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          style={{ right: '1rem', bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          aria-label={jumpLabelFor(jumpTo, newestEnd)}
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={jumpTo === 'top' ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}
            />
          </svg>
        </button>
      )}
    </div>
  );
});

export default InfiniteScrollTransactionList;
