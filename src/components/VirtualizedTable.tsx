import React, { memo, useMemo, ReactNode, useCallback } from 'react';
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
    <div className={`flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 ${headerClassName || ''}`}>
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
          className={`px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300 ${column.headerClassName || ''}`}
          style={{ width: column.width }}
        >
          {column.sortable && onSort ? (
            <button
              onClick={() => handleSort(column.key)}
              className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
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

export const VirtualizedTable = memo(function VirtualizedTable<T>({
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
}: VirtualizedTableProps<T>) {
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

    const baseRowClass = 'flex items-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800';
    const selectedClass = isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : '';
    const clickableClass = onRowClick ? 'cursor-pointer' : '';

    return (
      <div
        style={style}
        className={`${baseRowClass} ${selectedClass} ${clickableClass} ${computedRowClassName}`}
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

  // Debug log
  console.log('VirtualizedTable items:', items.length);
  
  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg shadow ${className}`}>
        <TableHeader
          columns={columns as Column<unknown>[]}
          headerClassName={headerClassName}
          showCheckbox={showCheckbox}
          selectedItems={selectedItems}
          items={items as unknown[]}
          getItemKey={getItemKey as (item: unknown, index: number) => string}
          onSelectionChange={onSelectionChange}
          onSort={onSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
        />
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow ${className}`}>
      <TableHeader
        columns={columns as Column<unknown>[]}
        headerClassName={headerClassName}
        showCheckbox={showCheckbox}
        selectedItems={selectedItems}
        items={items as unknown[]}
        getItemKey={getItemKey as (item: unknown, index: number) => string}
        onSelectionChange={onSelectionChange}
        onSort={onSort}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
      />
      
      <VirtualizedList
        items={items}
        renderItem={renderRow as (item: unknown, index: number, style: React.CSSProperties) => React.ReactElement}
        getItemKey={getItemKey as (item: unknown, index: number) => string}
        itemHeight={rowHeight}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
        threshold={threshold}
      />
    </div>
  );
});

VirtualizedTable.displayName = 'VirtualizedTable';

// Export utility hook for table column creation
export const useTableColumns = <T,>(
  columnDefinitions: Array<{
    key: string;
    header: string;
    width?: string | number;
    accessor: (item: T) => ReactNode;
    className?: string;
    headerClassName?: string;
    sortable?: boolean;
  }>
): Column<T>[] => {
  return useMemo(() => columnDefinitions, [columnDefinitions]);
};