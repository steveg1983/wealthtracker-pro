import React, { memo, useCallback, useRef, useMemo, ReactNode } from 'react';
import { FixedSizeList as List, VariableSizeList } from 'react-window';
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
}

interface ItemRendererProps<T> {
  index: number;
  style: React.CSSProperties;
  data: ItemData<T>;
}

// Memoized item renderer component
const ItemRenderer = memo(function ItemRenderer<T>({ 
  index, 
  style, 
  data 
}: ItemRendererProps<T>) {
  const { items, renderItem } = data;
  const item = items[index];
  
  if (!item) return null;
  
  return <>{renderItem(item, index, style)}</>;
});

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
  const listRef = useRef<List | VariableSizeList>(null);
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
  useMemo(() => {
    if (isVariableHeight) {
      itemHeightMap.current.clear();
    }
  }, [items, isVariableHeight]);
  
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
              return isVariableHeight ? (
                <VariableSizeList
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

// Export a hook for easy row height calculation
export const useRowHeightCalculator = (
  baseHeight: number,
  options?: {
    padding?: number;
    hasSubtext?: boolean;
    hasActions?: boolean;
    hasTags?: boolean;
  }
) => {
  return useCallback(() => {
    let height = baseHeight;
    
    if (options?.padding) {
      height += options.padding * 2;
    }
    
    if (options?.hasSubtext) {
      height += 20; // Additional line for subtext
    }
    
    if (options?.hasActions) {
      height += 24; // Space for action buttons
    }
    
    if (options?.hasTags) {
      height += 24; // Space for tags
    }
    
    return height;
  }, [baseHeight, options]);
};