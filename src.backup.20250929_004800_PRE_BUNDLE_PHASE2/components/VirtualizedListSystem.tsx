import React, {
  useCallback,
  useRef,
  useEffect,
  useState,
  useMemo,
  type MutableRefObject
} from 'react';
import {
  FixedSizeList as FixedSizeListComponent,
  VariableSizeList as VariableSizeListComponent
} from 'react-window';
import type {
  FixedSizeList,
  VariableSizeList,
  ListChildComponentProps,
  ListOnItemsRenderedProps,
  ListOnScrollProps
} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LoadingIcon, ChevronUpIcon } from './icons';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isScrolling?: boolean) => React.ReactNode;
  itemHeight?: number | ((index: number) => number);
  overscan?: number;
  onLoadMore?: (() => Promise<void>) | undefined;
  hasMore?: boolean;
  loading?: boolean;
  className?: string;
  emptyState?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scrollToTopThreshold?: number;
  estimatedItemSize?: number;
  getItemKey?: (index: number, item: T) => string;
  horizontal?: boolean;
  useWindowScroll?: boolean;
}

interface InternalItemData<T> {
  items: T[];
  renderItem: (item: T, index: number, isScrolling?: boolean) => React.ReactNode;
  hasMore: boolean;
}

/**
 * High-Performance Virtualized List Component
 * Design principles:
 * 1. Handles thousands of items smoothly
 * 2. Automatic height calculation
 * 3. Infinite scroll support
 * 4. Scroll restoration
 * 5. Mobile optimized
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight = 60,
  overscan = 5,
  onLoadMore,
  hasMore = false,
  loading = false,
  className = '',
  emptyState,
  header,
  footer,
  scrollToTopThreshold = 300,
  estimatedItemSize = 60,
  getItemKey,
  horizontal = false,
  useWindowScroll = false
}: VirtualizedListProps<T>): React.JSX.Element {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollPositionRef = useRef(0);
  const listRef = useRef<
    FixedSizeList<InternalItemData<T>> | VariableSizeList<InternalItemData<T>> | null
  >(null);

  // Determine if we should use fixed or variable size list
  const isFixedHeight = typeof itemHeight === 'number';

  // Handle scroll events
  const handleScroll = useCallback((event: ListOnScrollProps) => {
    const scrollOffset = event.scrollOffset ?? 0;
    scrollPositionRef.current = scrollOffset;
    setShowScrollTop(scrollOffset > scrollToTopThreshold);
  }, [scrollToTopThreshold]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0, 'start');
    }
  }, []);

  // Load more items when needed
  const loadMoreItems = useCallback(
    async (_startIndex: number, _stopIndex: number) => {
      if (onLoadMore && !loading) {
        await onLoadMore();
      }
    },
    [onLoadMore, loading]
  );

  // Check if an item is loaded
  const isItemLoaded = useCallback(
    (index: number) => {
      return !hasMore || index < items.length;
    },
    [hasMore, items.length]
  );

  // Item count including potential unloaded items
  const itemCount = hasMore ? items.length + 1 : items.length;

  const itemData = useMemo<InternalItemData<T>>(() => ({
    items,
    renderItem,
    hasMore
  }), [items, renderItem, hasMore]);

  const getItemSize = useCallback((index: number) => {
    if (typeof itemHeight === 'function') {
      return itemHeight(index);
    }
    return itemHeight;
  }, [itemHeight]);

  const renderRow = useCallback(
    ({ index, style, isScrolling, data }: ListChildComponentProps<InternalItemData<T>>) => {
      const item = data.items[index];

      if (!item) {
        if (!data.hasMore) {
          return null;
        }

        return (
          <div
            style={style}
            className="flex items-center justify-center p-4 text-sm text-gray-500"
          >
            <LoadingIcon size={20} className="mr-2 animate-spin text-gray-400" />
            Loading more…
          </div>
        );
      }

      return (
        <div style={style} className="virtualized-item">
          {data.renderItem(item, index, isScrolling)}
        </div>
      );
    },
    []
  );

  // Empty state
  if (items.length === 0 && !loading) {
    return (
      <div className={className}>
        {header}
        {emptyState || (
          <div className="flex items-center justify-center p-8 text-gray-500">
            No items to display
          </div>
        )}
        {footer}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {header}
      
      <AutoSizer>
        {({ height, width }) => (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
            minimumBatchSize={10}
            threshold={5}
          >
            {({ onItemsRendered, ref }) => {
              const assignListRef = (
                list: FixedSizeList<InternalItemData<T>> | VariableSizeList<InternalItemData<T>> | null
              ) => {
                listRef.current = list;

                if (typeof ref === 'function') {
                  ref(list);
                } else if (ref) {
                  (ref as MutableRefObject<
                    FixedSizeList<InternalItemData<T>> | VariableSizeList<InternalItemData<T>> | null
                  >).current = list;
                }
              };

              const layoutDirection: 'horizontal' | 'vertical' = horizontal ? 'horizontal' : 'vertical';

              const commonProps = {
                height,
                width,
                itemCount,
                itemData,
                overscanCount: overscan,
                onScroll: handleScroll,
                onItemsRendered: (props: ListOnItemsRenderedProps) => {
                  onItemsRendered(props);
                },
                layout: layoutDirection,
                useIsScrolling: true
              };

              const resolveItemKey = (index: number, data: InternalItemData<T>) => {
                const item = data.items[index];
                if (item && getItemKey) {
                  return getItemKey(index, item);
                }
                return data.hasMore ? `loading-${index}` : `virtual-item-${index}`;
              };

              if (isFixedHeight) {
                return (
                  <FixedSizeListComponent<InternalItemData<T>>
                    ref={assignListRef}
                    {...commonProps}
                    itemSize={itemHeight as number}
                    itemKey={resolveItemKey}
                  >
                    {renderRow}
                  </FixedSizeListComponent>
                );
              }

              return (
                <VariableSizeListComponent<InternalItemData<T>>
                  ref={assignListRef}
                  {...commonProps}
                  itemSize={getItemSize}
                  estimatedItemSize={estimatedItemSize}
                  itemKey={resolveItemKey}
                >
                  {renderRow}
                </VariableSizeListComponent>
              );
            }}
          </InfiniteLoader>
        )}
      </AutoSizer>

      {footer}

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-4 z-40 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-secondary transition-all duration-200 transform hover:scale-110"
          aria-label="Scroll to top"
        >
          <ChevronUpIcon size={20} />
        </button>
      )}

      {/* Loading overlay */}
      {loading && items.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
          <LoadingIcon size={32} className="animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

/**
 * Tanstack Virtual List for more complex scenarios
 * Better for dynamic content and complex layouts
 */
export function TanstackVirtualList<T>({
  items,
  renderItem,
  estimatedItemSize = 60,
  overscan = 5,
  className = '',
  useWindowScroll = false,
  horizontal = false
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimatedItemSize?: number;
  overscan?: number;
  className?: string;
  useWindowScroll?: boolean;
  horizontal?: boolean;
}): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<HTMLElement>();

  useEffect(() => {
    scrollingRef.current = useWindowScroll 
      ? document.documentElement
      : parentRef.current || undefined;
  }, [useWindowScroll]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollingRef.current || null,
    estimateSize: () => estimatedItemSize,
    overscan,
    horizontal
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div 
      ref={parentRef}
      className={`${className} ${useWindowScroll ? '' : 'h-full overflow-auto'}`}
    >
      <div
        style={{
          [horizontal ? 'width' : 'height']: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) {
            return null;
          }

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                [horizontal ? 'left' : 'top']: 0,
                [horizontal ? 'top' : 'left']: 0,
                [horizontal ? 'height' : 'width']: '100%',
                transform: horizontal
                  ? `translateX(${virtualItem.start}px)`
                  : `translateY(${virtualItem.start}px)`
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Specialized virtualized list for transactions
 */
export function VirtualizedTransactionList({
  transactions,
  onTransactionClick,
  selectedIds = [],
  onSelectionChange,
  showCheckboxes = false
}: {
  transactions: any[];
  onTransactionClick?: (transaction: any) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showCheckboxes?: boolean;
}): React.JSX.Element {
  const renderTransaction = useCallback((transaction: any, index: number, isScrolling?: boolean) => {
    const isSelected = selectedIds.includes(transaction.id);
    
    // Use simpler rendering when scrolling for better performance
    if (isScrolling) {
      return (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      );
    }

    return (
      <div
        className={`
          p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800
          cursor-pointer transition-colors
          ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
        `}
        onClick={() => onTransactionClick?.(transaction)}
      >
        <div className="flex items-center justify-between">
          {showCheckboxes && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                const newSelection = isSelected
                  ? selectedIds.filter(id => id !== transaction.id)
                  : [...selectedIds, transaction.id];
                onSelectionChange?.(newSelection);
              }}
              className="mr-3"
            />
          )}
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-white">
              {transaction.description}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {transaction.date} • {transaction.category}
            </div>
          </div>
          <div className={`font-semibold ${
            transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            ${Math.abs(transaction.amount).toFixed(2)}
          </div>
        </div>
      </div>
    );
  }, [selectedIds, onTransactionClick, onSelectionChange, showCheckboxes]);

  return (
    <VirtualizedList
      items={transactions}
      renderItem={renderTransaction}
      itemHeight={80}
      overscan={10}
      className="h-full"
      emptyState={
        <div className="p-8 text-center text-gray-500">
          No transactions found
        </div>
      }
    />
  );
}

/**
 * Virtualized dropdown for large lists
 */
export function VirtualizedDropdown<T>({
  items,
  value,
  onChange,
  renderOption,
  placeholder = 'Select...',
  searchable = true,
  className = ''
}: {
  items: T[];
  value: T | null;
  onChange: (value: T) => void;
  renderOption: (item: T) => React.ReactNode;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item => {
      const text = renderOption(item);
      if (typeof text === 'string') {
        return text.toLowerCase().includes(searchLower);
      }
      return true;
    });
  }, [items, search, renderOption]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const renderItem = useCallback((item: T, index: number) => (
    <div
      className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      onClick={() => {
        onChange(item);
        setIsOpen(false);
        setSearch('');
      }}
    >
      {renderOption(item)}
    </div>
  ), [onChange, renderOption]);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500"
      >
        {value ? renderOption(value) : <span className="text-gray-500">{placeholder}</span>}
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {searchable && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-4 py-2 border-b border-gray-200 dark:border-gray-700"
              autoFocus
            />
          )}
          <div style={{ height: '300px' }}>
            <TanstackVirtualList
              items={filteredItems}
              renderItem={renderItem}
              estimatedItemSize={40}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
