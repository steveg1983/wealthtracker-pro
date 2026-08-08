import React, { memo, useCallback, useRef, useMemo, useEffect, ReactNode } from 'react';
import { FixedSizeList as List, VariableSizeList, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { deliverScroll } from '../utils/deliverScroll';

export interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, style: React.CSSProperties) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  itemHeight?: number | ((index: number) => number);
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  overscanCount?: number;
  className?: string;
  estimatedItemSize?: number;
  threshold?: number;
  /**
   * Index to bring into view — the deep-link "jump to this row" affordance.
   * Applied whenever the value changes; retried briefly because AutoSizer's
   * first pass renders at height 0 and a scroll issued then silently clamps
   * to the top.
   */
  scrollToIndex?: number;
  /**
   * How to place that row: CENTRED (the default, and what a deep-link jump
   * wants — the row lands in the middle of an unfamiliar list) or NEAREST,
   * which scrolls the least amount that brings the row fully into view and
   * does nothing at all when it is already visible. Keyboard row-stepping
   * uses nearest: centring on every arrow key would heave the whole list
   * under the user one line at a time.
   *
   * A row that has just grown an editor inside it wants centre too — the row
   * being worked on belongs in the middle, with its neighbours either side.
   * The register's full rule is written out in AccountTransactions.
   */
  scrollToAlign?: 'center' | 'nearest';
  /**
   * A count that says "asked again".
   *
   * scrollToIndex alone answers "which row", and a request for the row that is
   * already the target is not a change React can see. So a caller that needs
   * the SAME row placed the SAME way a second time — the register re-centring a
   * row whose editor has just been re-opened, after the user has scrolled off
   * somewhere else — bumps this instead, and the scroll runs again.
   */
  scrollToToken?: number;
  /**
   * A pulse asking the list to park at its FOOT (last item fully visible).
   * Any change to a truthy value performs the scroll once; 0/undefined means
   * nothing was asked. A pulse rather than a boolean because "show me the
   * end" is an event, not a state — the user must be free to scroll away
   * afterwards without the list dragging them back.
   */
  scrollToBottomToken?: number;
  onItemsRendered?: (props: {
    visibleStartIndex: number;
    visibleStopIndex: number;
    overscanStartIndex: number;
    overscanStopIndex: number;
  }) => void;
}

interface ItemData<T> {
  items: T[];
  renderItem: (item: T, index: number, style: React.CSSProperties) => ReactNode;
  getItemKey: (item: T, index: number) => string;
}

interface _ItemRendererProps<T> {
  index: number;
  style: React.CSSProperties;
  data: ItemData<T>;
}

// Memoized item renderer component
const ItemRenderer = memo(function ItemRenderer<T>({
  index,
  style,
  data
}: ListChildComponentProps<ItemData<T>>) {
  const { items, renderItem } = data;
  const item = items[index];

  if (!item) return null;

  return <>{renderItem(item, index, style)}</>;
}) as <T>(props: ListChildComponentProps<ItemData<T>>) => JSX.Element | null;

export const VirtualizedList = memo(function VirtualizedList<T>({
  items,
  renderItem,
  getItemKey,
  itemHeight = 80,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  overscanCount = 5,
  className = '',
  estimatedItemSize = 80,
  threshold = 100,
  scrollToIndex,
  scrollToAlign = 'center',
  scrollToToken,
  scrollToBottomToken,
  onItemsRendered
}: VirtualizedListProps<T>) {
  const listRef = useRef<List | VariableSizeList | null>(null);
  /**
   * The same list again, but only when it is the VARIABLE-height one.
   *
   * react-window caches every row's offset the first time it measures it, and
   * only VariableSizeList can be told to forget (resetAfterIndex). Kept as its
   * own typed ref rather than narrowing listRef, so the reset below is a plain
   * call on a known type instead of a cast.
   */
  const variableListRef = useRef<VariableSizeList | null>(null);
  const plainContainerRef = useRef<HTMLDivElement | null>(null);
  const itemHeightMap = useRef<Map<number, number>>(new Map());
  
  // Determine if we need variable size list
  const isVariableHeight = typeof itemHeight === 'function';
  
  // Memoize item data to prevent re-renders
  const itemData = useMemo<ItemData<T>>(() => ({
    items,
    renderItem,
    getItemKey
  }), [items, renderItem, getItemKey]);
  
  // Determine if an item is loaded
  const isItemLoaded = useCallback((index: number) => {
    return !hasMore || index < items.length;
  }, [hasMore, items.length]);
  
  // Load more items
  const loadMoreItems = useCallback(() => {
    if (isLoading || !onLoadMore) return Promise.resolve();
    onLoadMore();
    return Promise.resolve();
  }, [isLoading, onLoadMore]);
  
  // Calculate item count
  const itemCount = hasMore ? items.length + 1 : items.length;
  
  // Get item size for variable height lists
  const getItemSize = useCallback((index: number) => {
    if (typeof itemHeight === 'function') {
      // Check if we have a cached height
      const cachedHeight = itemHeightMap.current.get(index);
      if (cachedHeight) return cachedHeight;
      
      // Calculate and cache the height
      const height = itemHeight(index);
      itemHeightMap.current.set(index, height);
      return height;
    }
    return itemHeight;
  }, [itemHeight]);
  
  /**
   * Forget every measured height when the heights themselves could have moved.
   *
   * Two things can move them: a different list of items, and a different
   * itemHeight function (the register hands us a new one the moment its
   * quick-edit box opens under a different row). Clearing the local cache is
   * only half of it — react-window keeps its OWN offset table, and without
   * resetAfterIndex the rows below a newly-taller row keep their old positions
   * and paint on top of each other.
   *
   * Declared ABOVE the scroll effects on purpose: a render that both moves the
   * box and asks for a row to be scrolled into view must re-measure first, or
   * the scroll is computed against yesterday's geometry.
   */
  useEffect(() => {
    if (!isVariableHeight) return;
    itemHeightMap.current.clear();
    variableListRef.current?.resetAfterIndex(0, true);
  }, [items, isVariableHeight, itemHeight]);
  
  // Determine if we should enable virtual scrolling
  const shouldVirtualize = items.length > threshold;

  // Bring the requested row into view. react-window owns the maths on the
  // virtual path; on the plain path it is rect arithmetic against the scroll
  // container.
  //
  // `apply` reports whether there was anything to scroll, and deliverScroll
  // keeps asking until there is — because on the virtual path there routinely
  // ISN'T. AutoSizer renders no children at all until the browser has measured
  // it, so react-window does not exist during the commit that asks for the
  // scroll, and the ref this function reaches for is null. See deliverScroll
  // for why a blind three-shot retry was not enough.
  //
  // Declared AFTER the re-measure above, and that order is load-bearing: a
  // render that both grows a row (an editor opening inside it) and asks for
  // that row to be brought into view must forget the old heights first, or the
  // scroll is computed against the geometry the list had a moment ago.
  useEffect(() => {
    if (scrollToIndex === undefined || scrollToIndex < 0 || scrollToIndex >= items.length) return;
    const apply = (): boolean => {
      const list = listRef.current;
      if (list) {
        // react-window's 'auto' is exactly "nearest": it scrolls the minimum
        // needed and stays put when the row is already on screen.
        list.scrollToItem(scrollToIndex, scrollToAlign === 'nearest' ? 'auto' : 'center');
        return true;
      }
      const container = plainContainerRef.current;
      const candidate = container?.children[scrollToIndex];
      // Not a cast: the collection is of Elements, and only an HTMLElement has
      // the box this arithmetic reads.
      const row = candidate instanceof HTMLElement ? candidate : null;
      if (!container || !row) return false;
      // offsetTop answers to the nearest POSITIONED ancestor, which the
      // container is not — rects are unambiguous.
      const delta = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
      const rowTop = container.scrollTop + delta;
      if (scrollToAlign === 'nearest') {
        // offsetHeight, not clientHeight: these rows carry a bottom border, and
        // a row scrolled to within its own border width is still cut off.
        const rowBottom = rowTop + row.offsetHeight;
        if (rowTop < container.scrollTop) {
          container.scrollTop = rowTop;
        } else if (rowBottom > container.scrollTop + container.clientHeight) {
          container.scrollTop = rowBottom - container.clientHeight;
        }
        return true;
      }
      container.scrollTop = Math.max(
        0,
        rowTop - container.clientHeight / 2 + row.clientHeight / 2
      );
      return true;
    };
    return deliverScroll(apply);
  }, [scrollToIndex, scrollToAlign, scrollToToken, items.length]);

  // The item count as of the latest render, for the foot-scroll below. Read
  // through a ref so that scroll fires ONCE per pulse: with items.length in
  // the effect's dependencies, every later change to the list (a new
  // transaction, a background refresh) would re-run it and drag a user who had
  // scrolled away back to the end.
  const itemCountRef = useRef(items.length);
  useEffect(() => {
    itemCountRef.current = items.length;
  }, [items.length]);

  // Park at the foot. Delivered the same way and for the same reason as above —
  // and with the same benefit for a second kind of "not there yet": a register
  // whose rows have not arrived has nothing to be at the foot OF, so an empty
  // list is a reason to ask again rather than a scroll to give up on.
  useEffect(() => {
    if (!scrollToBottomToken) return;
    const apply = (): boolean => {
      const count = itemCountRef.current;
      if (count === 0) return false;
      const list = listRef.current;
      if (list) {
        list.scrollToItem(count - 1, 'end');
        return true;
      }
      const container = plainContainerRef.current;
      if (!container) return false;
      // Beyond the maximum is fine: the DOM clamps scrollTop to
      // scrollHeight - clientHeight, which IS the foot.
      container.scrollTop = container.scrollHeight;
      return true;
    };
    return deliverScroll(apply);
  }, [scrollToBottomToken]);


  // Render non-virtualized list for small datasets.
  // data-virtualized-list marks the element that actually scrolls on this path
  // (the virtualised path scrolls react-window's own outer element), so the
  // scroll behaviour can be asserted rather than assumed.
  if (!shouldVirtualize) {
    return (
      <div
        ref={plainContainerRef}
        data-virtualized-list
        className={`flex-1 min-h-0 overflow-y-auto ${className}`}
      >
        {items.map((item, index) => (
          <div key={getItemKey(item, index)}>
            {renderItem(item, index, {})}
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className={`flex-1 w-full min-h-0 overflow-hidden ${className}`}>
      <AutoSizer>
        {({ height, width }) => (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered: onInfiniteItemsRendered, ref }) => {
              return isVariableHeight ? (
                <VariableSizeList<ItemData<T>>
                  ref={(list) => {
                    // Null included, deliberately. React calls a ref with null
                    // as the element goes away, and dropping that call left
                    // these two pointing at an UNMOUNTED list — which happens
                    // for real: a search that narrows a virtualised register
                    // below the threshold takes react-window off screen and
                    // puts the plain list up instead. Every scroll after that
                    // was issued to a dead component and silently did nothing,
                    // while the live container sat there unscrolled. A ref that
                    // outlives its element is not a cache, it is a lie.
                    listRef.current = list;
                    variableListRef.current = list;
                    if (typeof ref === 'function') {
                      ref(list);
                    } else if (ref && 'current' in ref) {
                      // Type assertion for mutable ref
                      (ref as React.MutableRefObject<unknown>).current = list;
                    }
                  }}
                  height={height}
                  itemCount={itemCount}
                  itemSize={getItemSize}
                  itemData={itemData}
                  onItemsRendered={(props) => {
                    onInfiniteItemsRendered(props);
                    onItemsRendered?.(props);
                  }}
                  width={width}
                  overscanCount={overscanCount}
                  estimatedItemSize={estimatedItemSize}
                  itemKey={(index, data) => {
                    const item = data.items[index];
                    return item ? data.getItemKey(item, index) : `loading-${index}`;
                  }}
                >
                  {ItemRenderer}
                </VariableSizeList>
              ) : (
                <List<ItemData<T>>
                  ref={(list) => {
                    // Null included — see the variable-height list above.
                    listRef.current = list;
                    // This one is not a VariableSizeList, so nothing here can
                    // be told to forget its measurements; leaving a previous
                    // list in that ref would aim resetAfterIndex at a component
                    // that is no longer on screen.
                    variableListRef.current = null;
                    if (typeof ref === 'function') {
                      ref(list);
                    } else if (ref && 'current' in ref) {
                      // Type assertion for mutable ref
                      (ref as React.MutableRefObject<unknown>).current = list;
                    }
                  }}
                  height={height}
                  itemCount={itemCount}
                  itemSize={itemHeight as number}
                  itemData={itemData}
                  itemKey={(index, data) => {
                    const item = data.items[index];
                    return item ? data.getItemKey(item, index) : `loading-${index}`;
                  }}
                  onItemsRendered={(props) => {
                    onInfiniteItemsRendered(props);
                    onItemsRendered?.(props);
                  }}
                  overscanCount={overscanCount}
                  width={width}
                >
                  {ItemRenderer}
                </List>
              );
            }}
          </InfiniteLoader>
        )}
      </AutoSizer>
    </div>
  );
});

VirtualizedList.displayName = 'VirtualizedList';
