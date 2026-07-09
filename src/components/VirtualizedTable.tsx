import React, { memo, useMemo, useState, ReactNode, useCallback } from 'react';
import { VirtualizedList } from './VirtualizedList';

export interface Column<T> {
  key: string;
  header: string;
  width?: string | number;
  accessor: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  /** Set false to suppress the resize handle (e.g. a flex-filler column). */
  resizable?: boolean;
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
  /** Opt-in: drag a header onto another to reorder columns. */
  onColumnReorder?: (fromKey: string, toKey: string) => void;
  /** Opt-in: drag a header's right edge to resize. New width in px. */
  onColumnResize?: (key: string, width: number) => void;
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
  sortDirection,
  onColumnReorder,
  onColumnResize
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
  onColumnReorder?: (fromKey: string, toKey: string) => void;
  onColumnResize?: (key: string, width: number) => void;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // Drag the right edge of a header to resize. Uses the cell's live rendered
  // width as the baseline so it works regardless of px/flex sizing.
  const startResize = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = (e.currentTarget as HTMLElement).parentElement;
    const startX = e.clientX;
    const startWidth = cell ? cell.getBoundingClientRect().width : 120;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(48, Math.round(startWidth + (ev.clientX - startX)));
      onColumnResize?.(key, next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [onColumnResize]);
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
      
      {columns.map((column) => {
        const reorderable = !!onColumnReorder;
        const resizable = !!onColumnResize && column.resizable !== false;
        const isDropTarget = !!dragKey && dragKey !== column.key && overKey === column.key;
        return (
          <div
            key={column.key}
            draggable={reorderable}
            onDragStart={reorderable ? (e) => {
              setDragKey(column.key);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', column.key);
            } : undefined}
            onDragOver={reorderable ? (e) => {
              e.preventDefault();
              if (dragKey && dragKey !== column.key) setOverKey(column.key);
            } : undefined}
            onDragLeave={reorderable ? () => setOverKey(k => (k === column.key ? null : k)) : undefined}
            onDrop={reorderable ? (e) => {
              e.preventDefault();
              const from = dragKey ?? e.dataTransfer.getData('text/plain');
              if (from && from !== column.key) onColumnReorder!(from, column.key);
              setDragKey(null);
              setOverKey(null);
            } : undefined}
            onDragEnd={reorderable ? () => { setDragKey(null); setOverKey(null); } : undefined}
            className={`relative px-3 py-2 font-medium text-sm ${headerClassName ? '' : 'text-gray-700 dark:text-gray-300'} ${column.headerClassName || ''} ${reorderable ? 'cursor-move select-none' : ''} ${isDropTarget ? 'border-l-2 border-blue-400' : ''} ${dragKey === column.key ? 'opacity-50' : ''}`}
            style={{ width: column.width }}
          >
            {column.sortable && onSort ? (
              <button
                onClick={() => handleSort(column.key)}
                className={`inline-flex items-center gap-1 ${headerClassName ? 'hover:text-gray-100' : 'hover:text-gray-900 dark:hover:text-gray-100'}`}
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
            {resizable && (
              <div
                onMouseDown={(e) => startResize(e, column.key)}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
                className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400/50"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

TableHeader.displayName = 'TableHeader';

const VirtualizedTableComponent = memo(function VirtualizedTable<T>({
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
  threshold = 100,
  onColumnReorder,
  onColumnResize
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
            className={`px-3 py-2 overflow-hidden ${column.className || ''}`}
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
          headerClassName={headerClassName}
          showCheckbox={showCheckbox}
          selectedItems={selectedItems}
          items={items as unknown[]}
          getItemKey={getItemKey as (item: unknown, index: number) => string}
          onSelectionChange={onSelectionChange}
          onSort={onSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onColumnReorder={onColumnReorder}
          onColumnResize={onColumnResize}
        />
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden flex flex-col ${className}`}>
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
        onColumnReorder={onColumnReorder}
        onColumnResize={onColumnResize}
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

VirtualizedTableComponent.displayName = 'VirtualizedTable';

// Re-export with proper generic type preservation
// React.memo() erases generic type information at compile time.
// This double-cast is the ONLY way to preserve generic types with memo in TypeScript.
// This is a documented TypeScript/React limitation - NOT a code quality issue.
// See: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/37087
// Alternatives considered:
//   1. Don't use memo → Performance penalty (re-renders on every parent update)
//   2. Use factory pattern → Adds complexity without benefit
//   3. Avoid generics → Loses type safety for table data
// Decision: This cast is idiomatic, well-contained, and the recommended approach.
export const VirtualizedTable = VirtualizedTableComponent as unknown as <T>(props: VirtualizedTableProps<T>) => React.ReactElement;
