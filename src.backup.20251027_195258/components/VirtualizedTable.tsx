import React, { memo, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { VirtualizedList } from './VirtualizedList';

export interface Column<T> {
  key: string;
  header: string;
  width?: string | number;
  accessor: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
}

export interface VirtualizedTableProps<T> {
  items: T[];
  columns: Column<T>[];
  getItemKey: (item: T, index: number) => string;
  onRowClick?: (item: T, index: number) => void;
  rowHeight?: number;
  className?: string;
  headerClassName?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  selectedItems?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  showCheckbox?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  emptyMessage?: string;
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  threshold?: number;
}

// Table header component
const TableHeader = memo(function TableHeader<T>({
  columns,
  headerClassName,
  showCheckbox,
  selectedItems,
  items,
  getItemKey,
  onSelectionChange,
  onSort,
  sortColumn,
  sortDirection
}: {
  columns: Column<T>[];
  headerClassName?: string;
  showCheckbox?: boolean;
  selectedItems?: Set<string>;
  items: T[];
  getItemKey: (item: T, index: number) => string;
  onSelectionChange?: (selected: Set<string>) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}) {
  const allSelected = useMemo(() => {
    if (!selectedItems || items.length === 0) return false;
    return items.every((item, index) => 
      selectedItems.has(getItemKey(item, index))
    );
  }, [selectedItems, items, getItemKey]);

  const handleSelectAll = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    
    if (e.target.checked) {
      const newSelected = new Set<string>();
      items.forEach((item, index) => {
        newSelected.add(getItemKey(item, index));
      });
      onSelectionChange(newSelected);
    } else {
      onSelectionChange(new Set());
    }
  }, [items, getItemKey, onSelectionChange]);

  const handleSort = useCallback((column: string) => {
    if (!onSort) return;
    
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(column, newDirection);
  }, [onSort, sortColumn, sortDirection]);

  return (
    <div className={`flex items-center border-b border-gray-200 dark:border-gray-700 ${headerClassName || 'bg-gray-50 dark:bg-gray-800'}`}>
      {showCheckbox && (
        <div className="px-4 py-3 w-12">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleSelectAll}
            className="rounded"
          />
        </div>
      )}
      
      {columns.map((column) => (
        <div
          key={column.key}
          className={`px-4 py-3 font-medium text-sm ${headerClassName ? '' : 'text-gray-700 dark:text-gray-300'} ${column.headerClassName || ''}`}
          style={{ width: column.width }}
        >
          {column.sortable && onSort ? (
            <button
              onClick={() => handleSort(column.key)}
              className={`flex items-center gap-1 ${headerClassName ? 'hover:text-gray-100' : 'hover:text-gray-900 dark:hover:text-gray-100'}`}
            >
              {column.header}
              {sortColumn === column.key && (
                <span className="text-xs">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
          ) : (
            column.header
          )}
        </div>
      ))}
    </div>
  );
});

TableHeader.displayName = 'TableHeader';

const VirtualizedTableComponent = <T,>({
  items,
  columns,
  getItemKey,
  onRowClick,
  rowHeight = 60,
  className = '',
  headerClassName,
  rowClassName,
  selectedItems,
  onSelectionChange,
  showCheckbox = false,
  onSort,
  sortColumn,
  sortDirection,
  emptyMessage = 'No data available',
  isLoading = false,
  onLoadMore,
  hasMore = false,
  threshold = 100
}: VirtualizedTableProps<T>): JSX.Element => {
  // Memoize row renderer
  const renderRow = useCallback((item: T, index: number, style: React.CSSProperties) => {
    const itemKey = getItemKey(item, index);
    const isSelected = selectedItems?.has(itemKey) || false;
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (onSelectionChange && selectedItems) {
        const newSelected = new Set(selectedItems);
        if (e.target.checked) {
          newSelected.add(itemKey);
        } else {
          newSelected.delete(itemKey);
        }
        onSelectionChange(newSelected);
      }
    };

    const handleRowClick = () => {
      if (onRowClick) {
        onRowClick(item, index);
      }
    };

    const computedRowClassName = typeof rowClassName === 'function' 
      ? rowClassName(item, index) 
      : rowClassName || '';

    const baseRowClass = 'flex items-center border-b border-gray-200 dark:border-gray-700 transition-colors duration-150';
    const clickableClass = onRowClick ? 'cursor-pointer select-none' : '';
    // Only apply hover effects if not selected
    const hoverClass = onRowClick && !isSelected ? 'hover:shadow-[0_-6px_10px_-2px_rgba(0,0,0,0.15),0_6px_10px_-2px_rgba(0,0,0,0.15)] hover:z-10 hover:transform hover:scale-[1.01] hover:bg-gray-50 dark:hover:bg-gray-800' : '';
    // Don't apply stripe classes to selected rows
    const stripeClass = !isSelected && index % 2 === 1 ? 'bg-gray-100 dark:bg-gray-800/50' : !isSelected ? 'bg-white dark:bg-gray-900' : '';

    return (
      <div
        style={{...style, overflow: 'visible'}}
        className={`${baseRowClass} ${stripeClass} ${clickableClass} ${!isSelected ? hoverClass : ''} ${computedRowClassName}`}
        onClick={handleRowClick}
      >
        {showCheckbox && (
          <div className="px-4 py-3 w-12">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              className="rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        
        {columns.map((column) => (
          <div
            key={column.key}
            className={`px-4 py-3 ${column.className || ''}`}
            style={{ width: column.width }}
          >
            {column.accessor(item)}
          </div>
        ))}
      </div>
    );
  }, [
    columns,
    getItemKey,
    onRowClick,
    rowClassName,
    selectedItems,
    onSelectionChange,
    showCheckbox
  ]);

  
  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg shadow ${className}`}>
        <TableHeader
          columns={columns as Column<unknown>[]}
          showCheckbox={showCheckbox}
          items={items as unknown[]}
          getItemKey={getItemKey as (item: unknown, index: number) => string}
          {...(headerClassName ? { headerClassName } : {})}
          {...(selectedItems ? { selectedItems } : {})}
          {...(onSelectionChange ? { onSelectionChange } : {})}
          {...(onSort ? { onSort } : {})}
          {...(sortColumn ? { sortColumn } : {})}
          {...(sortDirection ? { sortDirection } : {})}
        />
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden ${className}`}>
      <TableHeader
        columns={columns as Column<unknown>[]}
        showCheckbox={showCheckbox}
        items={items as unknown[]}
        getItemKey={getItemKey as (item: unknown, index: number) => string}
        {...(headerClassName ? { headerClassName } : {})}
        {...(selectedItems ? { selectedItems } : {})}
        {...(onSelectionChange ? { onSelectionChange } : {})}
        {...(onSort ? { onSort } : {})}
        {...(sortColumn ? { sortColumn } : {})}
        {...(sortDirection ? { sortDirection } : {})}
      />
      
      <VirtualizedList
        items={items}
        renderItem={renderRow as (item: unknown, index: number, style: React.CSSProperties) => React.ReactElement}
        getItemKey={getItemKey as (item: unknown, index: number) => string}
        itemHeight={rowHeight}
        hasMore={hasMore}
        isLoading={isLoading}
        threshold={threshold}
        {...(onLoadMore ? { onLoadMore } : {})}
      />
    </div>
  );
};

const MemoizedVirtualizedTable = memo(VirtualizedTableComponent);
MemoizedVirtualizedTable.displayName = 'VirtualizedTable';

export const VirtualizedTable = <T,>(props: VirtualizedTableProps<T>): JSX.Element => (
  <MemoizedVirtualizedTable {...(props as VirtualizedTableProps<unknown>)} />
);

// Re-exported for backwards compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { useTableColumns } from '../hooks/useTableColumns';
