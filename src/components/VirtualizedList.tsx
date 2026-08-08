import React, { memo, useCallback, useRef, useMemo, useEffect, ReactNode } from 'react';
import { FixedSizeList as List, VariableSizeList, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';

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
   */
  scrollToAlign?: 'center' | 'nearest';
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
  scrollToBottomToken,
  onItemsRendered
}: VirtualizedListProps<T>) {
  const listRef = useRef<List | VariableSizeList | null>(null);
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
  
  // Reset height cache when items change
  useEffect(() => {
    if (isVariableHeight) {
      itemHeightMap.current.clear();
    }
  }, [items, isVariableHeight]);
  
  // Determine if we should enable virtual scrolling
  const shouldVirtualize = items.length > threshold;

  // Bring the requested row into view. react-window owns the maths on the
  // virtual path; on the plain path it is rect arithmetic against the scroll
  // container. Retried at 0/100/300ms: AutoSizer's first pass is zero-height,
  // and a scroll issued against a zero-height list clamps to the top.
  useEffect(() => {
    if (scrollToIndex === undefined || scrollToIndex < 0 || scrollToIndex >= items.length) return;
    const apply = (): void => {
      if (listRef.current) {
        // react-window's 'auto' is exactly "nearest": it scrolls the minimum
        // needed and stays put when the row is already on screen.
        listRef.current.scrollToItem(scrollToIndex, scrollToAlign === 'nearest' ? 'auto' : 'center');
        return;
      }
      const container = plainContainerRef.current;
      const row = container?.children[scrollToIndex] as HTMLElement | undefined;
      if (!container || !row) return;
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
        return;
      }
      container.scrollTop = Math.max(
        0,
        rowTop - container.clientHeight / 2 + row.clientHeight / 2
      );
    };
    apply();
    const timers = [setTimeout(apply, 100), setTimeout(apply, 300)];
    return () => timers.forEach(clearTimeout);
  }, [scrollToIndex, scrollToAlign, items.length]);

  // The item count as of the latest render, for the foot-scroll below. Read
  // through a ref so that scroll fires ONCE per pulse: with items.length in
  // the effect's dependencies, every later change to the list (a new
  // transaction, a background refresh) would re-run it and drag a user who had
  // scrolled away back to the end.
  const itemCountRef = useRef(items.length);
  useEffect(() => {
    itemCountRef.current = items.length;
  }, [items.length]);

  // Park at the foot. Same retry schedule and for the same reason as above.
  useEffect(() => {
    if (!scrollToBottomToken) return;
    const apply = (): void => {
      const count = itemCountRef.current;
      if (count === 0) return;
      if (listRef.current) {
        listRef.current.scrollToItem(count - 1, 'end');
        return;
      }
      const container = plainContainerRef.current;
      // Beyond the maximum is fine: the DOM clamps scrollTop to
      // scrollHeight - clientHeight, which IS the foot.
      if (container) container.scrollTop = container.scrollHeight;
    };
    apply();
    const timers = [setTimeout(apply, 100), setTimeout(apply, 300)];
    return () => timers.forEach(clearTimeout);
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
                    // Handle both refs
                    if (list) {
                      listRef.current = list;
                      if (typeof ref === 'function') {
                        ref(list);
                      } else if (ref && 'current' in ref) {
                        // Type assertion for mutable ref
                        (ref as React.MutableRefObject<unknown>).current = list;
                      }
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
                    // Handle both refs
                    if (list) {
                      listRef.current = list;
                      if (typeof ref === 'function') {
                        ref(list);
                      } else if (ref && 'current' in ref) {
                        // Type assertion for mutable ref
                        (ref as React.MutableRefObject<unknown>).current = list;
                      }
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
