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
   * Index to bring into view, CENTRED in the viewport — the deep-link "jump
   * to this row" affordance. Applied whenever the value changes; retried
   * briefly because AutoSizer's first pass renders at height 0 and a scroll
   * issued then silently clamps to the top.
   */
  scrollToIndex?: number;
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

  // Centre the requested row. react-window owns the maths on the virtual
  // path; on the plain path it is offsetTop against the scroll container.
  // Retried at 0/100/300ms: AutoSizer's first pass is zero-height, and a
  // scroll issued against a zero-height list clamps to the top.
  useEffect(() => {
    if (scrollToIndex === undefined || scrollToIndex < 0 || scrollToIndex >= items.length) return;
    const apply = (): void => {
      if (listRef.current) {
        listRef.current.scrollToItem(scrollToIndex, 'center');
        return;
      }
      const container = plainContainerRef.current;
      const row = container?.children[scrollToIndex] as HTMLElement | undefined;
      if (container && row) {
        // offsetTop answers to the nearest POSITIONED ancestor, which the
        // container is not — rects are unambiguous.
        const delta = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollTop = Math.max(
          0,
          container.scrollTop + delta - container.clientHeight / 2 + row.clientHeight / 2
        );
      }
    };
    apply();
    const timers = [setTimeout(apply, 100), setTimeout(apply, 300)];
    return () => timers.forEach(clearTimeout);
  }, [scrollToIndex, items.length]);


  // Render non-virtualized list for small datasets
  if (!shouldVirtualize) {
    return (
      <div ref={plainContainerRef} className={`flex-1 min-h-0 overflow-y-auto ${className}`}>
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
