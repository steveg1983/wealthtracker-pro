import React, {
  memo,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type ReactNode,
  type MutableRefObject
} from 'react';
import {
  FixedSizeList as FixedSizeListComponent,
  VariableSizeList as VariableSizeListComponent
} from 'react-window';
import type {
  FixedSizeList,
  VariableSizeList,
  ListOnItemsRenderedProps,
  ListChildComponentProps
} from 'react-window';
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
  hasMore: boolean;
  isLoading: boolean;
}

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
  onItemsRendered
}: VirtualizedListProps<T>) {
  const listRef = useRef<FixedSizeList<ItemData<T>> | VariableSizeList<ItemData<T>> | null>(null);
  const itemHeightMap = useRef<Map<number, number>>(new Map());
  
  // Determine if we need variable size list
  const isVariableHeight = typeof itemHeight === 'function';
  
  // Memoize item data to prevent re-renders
  const itemData = useMemo<ItemData<T>>(() => ({
    items,
    renderItem,
    getItemKey,
    hasMore,
    isLoading
  }), [items, renderItem, getItemKey, hasMore, isLoading]);
  
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
  
  const renderRow = useCallback(
    ({ index, style, data }: ListChildComponentProps<ItemData<T>>) => {
      const item = data.items[index];

      if (!item) {
        if (!data.hasMore) {
          return null;
        }

        return (
          <div
            style={style}
            className="flex items-center justify-center text-sm text-gray-500"
          >
            Loading…
          </div>
        );
      }

      return <div style={style}>{data.renderItem(item, index, style)}</div>;
    },
    []
  );

  // Determine if we should enable virtual scrolling
  const shouldVirtualize = items.length > threshold;

  // Render non-virtualized list for small datasets
  if (!shouldVirtualize) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={getItemKey(item, index)}>
            {renderItem(item, index, {})}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex-1 w-full h-full overflow-hidden ${className}`}>
      <AutoSizer>
        {({ height, width }) => (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered: onInfiniteItemsRendered, ref }) => {
              const assignListRef = (
                list: FixedSizeList<ItemData<T>> | VariableSizeList<ItemData<T>> | null
              ) => {
                listRef.current = list;

                if (typeof ref === 'function') {
                  ref(list);
                } else if (ref) {
                  (ref as MutableRefObject<FixedSizeList<ItemData<T>> | VariableSizeList<ItemData<T>> | null>).current = list;
                }
              };

              return isVariableHeight ? (
                <VariableSizeListComponent<ItemData<T>>
                  ref={assignListRef}
                  height={height}
                  itemCount={itemCount}
                  itemSize={getItemSize}
                  itemData={itemData}
                  onItemsRendered={(props: ListOnItemsRenderedProps) => {
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
                  {renderRow}
                </VariableSizeListComponent>
              ) : (
                <FixedSizeListComponent<ItemData<T>>
                  ref={assignListRef}
                  height={height}
                  itemCount={itemCount}
                  itemSize={itemHeight as number}
                  itemData={itemData}
                  itemKey={(index, data) => {
                    const item = data.items[index];
                    return item ? data.getItemKey(item, index) : `loading-${index}`;
                  }}
                  onItemsRendered={(props: ListOnItemsRenderedProps) => {
                    onInfiniteItemsRendered(props);
                    onItemsRendered?.(props);
                  }}
                  overscanCount={overscanCount}
                  width={width}
                >
                  {renderRow}
                </FixedSizeListComponent>
              );
            }}
          </InfiniteLoader>
        )}
      </AutoSizer>
    </div>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

// Re-export helper hook for backwards compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { useRowHeightCalculator } from '../hooks/useRowHeightCalculator';
