import React, { useCallback, useRef, useEffect, useState, memo, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { FixedSizeList, VariableSizeList, ListChildComponentProps, ListOnItemsRenderedProps, ListOnScrollProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LoadingIcon, ChevronUpIcon } from './icons';
import type { Transaction } from '../types';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isScrolling?: boolean) => React.ReactNode;
  itemHeight?: number | ((index: number) => number);
  overscan?: number;
  onLoadMore?: () => Promise<void>;
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
  const listRef = useRef<FixedSizeList | VariableSizeList>(null);

  // Determine if we should use fixed or variable size list
  const isFixedHeight = typeof itemHeight === 'number';

  // Handle scroll events
  const handleScroll = useCallback((event: ListOnScrollProps) => {
    const scrollTop = event.scrollOffset || 0;
    scrollPositionRef.current = scrollTop;
    setShowScrollTop(scrollTop > scrollToTopThreshold);
  }, [scrollToTopThreshold]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (useWindowScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    listRef.current?.scrollToItem(0, 'start');
  }, [useWindowScroll]);

  // Load more items when needed
  const loadMoreItems = useCallback(
    (_startIndex: number, _stopIndex: number) => {
      if (onLoadMore && !loading) {
        return onLoadMore();
      }
      return Promise.resolve();
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

  const assignListRef = useCallback(
    (
      instance: FixedSizeList | VariableSizeList | null,
      loaderRef: ((ref: FixedSizeList | VariableSizeList | null) => void) | MutableRefObject<FixedSizeList | VariableSizeList | null> | undefined
    ) => {
      listRef.current = instance;
      if (!loaderRef) {
        return;
      }
      if (typeof loaderRef === 'function') {
        loaderRef(instance);
      } else {
        loaderRef.current = instance;
      }
    },
    []
  );

  const containerClassName = useWindowScroll ? className : `relative ${className}`;

  // Row renderer
  const Row = memo(({ index, style, isScrolling, data }: ListChildComponentProps<T[]>) => {
    if (!isItemLoaded(index)) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          <LoadingIcon size={24} className="animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading more...</span>
        </div>
      );
    }

    const item = data[index];
    if (!item) return null;

    return (
      <div style={style} className="virtualized-item">
        {renderItem(item, index, isScrolling)}
      </div>
    );
  });

  Row.displayName = 'VirtualizedRow';

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
    <div className={containerClassName}>
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
              const loaderRef = ref as ((ref: FixedSizeList | VariableSizeList | null) => void) | MutableRefObject<FixedSizeList | VariableSizeList | null> | undefined;

              if (isFixedHeight) {
                return (
                  <FixedSizeList
                    ref={(instance) => assignListRef(instance, loaderRef)}
                    height={height}
                    width={width}
                    itemCount={itemCount}
                    itemSize={itemHeight as number}
                    itemData={items}
                    overscanCount={overscan}
                    onScroll={handleScroll}
                    onItemsRendered={(props: ListOnItemsRenderedProps) => {
                      onItemsRendered(props);
                    }}
                    itemKey={(index, data) => {
                      const item = data[index];
                      return getItemKey ? getItemKey(index, item) : index.toString();
                    }}
                    direction={horizontal ? 'horizontal' : 'vertical'}
                    useIsScrolling
                  >
                    {Row}
                  </FixedSizeList>
                );
              }

              const variableItemSize = itemHeight as (index: number) => number;

              return (
                <VariableSizeList
                  ref={(instance) => assignListRef(instance, loaderRef)}
                  height={height}
                  width={width}
                  itemCount={itemCount}
                  itemSize={variableItemSize}
                  itemData={items}
                  overscanCount={overscan}
                  onScroll={handleScroll}
                  onItemsRendered={(props: ListOnItemsRenderedProps) => {
                    onItemsRendered(props);
                  }}
                  estimatedItemSize={estimatedItemSize}
                  itemKey={(index, data) => {
                    const item = data[index];
                    return getItemKey ? getItemKey(index, item) : index.toString();
                  }}
                  direction={horizontal ? 'horizontal' : 'vertical'}
                  useIsScrolling
                >
                  {Row}
                </VariableSizeList>
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
type TransactionListItem = Pick<Transaction, 'id' | 'description' | 'category' | 'amount'> & {
  date: Date | string;
};

export function VirtualizedTransactionList({
  transactions,
  onTransactionClick,
  selectedIds = [],
  onSelectionChange,
  showCheckboxes = false
}: {
  transactions: TransactionListItem[];
  onTransactionClick?: (transaction: TransactionListItem) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showCheckboxes?: boolean;
}): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const renderTransaction = useCallback((transaction: TransactionListItem, index: number, isScrolling?: boolean) => {
    const isSelected = selectedIds.includes(transaction.id);
    const formattedDate = transaction.date instanceof Date
      ? transaction.date.toLocaleDateString()
      : transaction.date;
    
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
              {formattedDate} • {transaction.category}
            </div>
          </div>
          <div className={`font-semibold ${
            transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrency(Math.abs(transaction.amount))}
          </div>
        </div>
      </div>
    );
  }, [selectedIds, onTransactionClick, onSelectionChange, showCheckboxes, formatCurrency]);

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

  const renderItem = useCallback((item: T, _index: number) => (
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
