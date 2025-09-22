/**
 * VirtualizedTable Component - High-performance table for large datasets
 *
 * Features:
 * - Virtual scrolling for performance
 * - Sorting and filtering
 * - Row selection
 * - Responsive design
 * - Keyboard navigation
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

interface Column<T = any> {
  key: string;
  title: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  headerRender?: () => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface VirtualizedTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  height?: number;
  className?: string;
  onRowClick?: (row: T, index: number) => void;
  onRowSelect?: (selectedRows: T[]) => void;
  selectable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  keyField?: string;
}

const OVERSCAN = 5; // Number of rows to render outside visible area

function VirtualizedTable<T = any>({
  data,
  columns,
  rowHeight = 48,
  height = 400,
  className = '',
  onRowClick,
  onRowSelect,
  selectable = false,
  sortable = true,
  filterable = false,
  loading = false,
  emptyMessage = 'No data available',
  keyField = 'id'
}: VirtualizedTableProps<T>): React.JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    if (filterable && Object.keys(filters).length > 0) {
      result = result.filter(row => {
        return Object.entries(filters).every(([key, filterValue]) => {
          if (!filterValue) return true;
          const cellValue = (row as any)[key];
          return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
        });
      });
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = (a as any)[sortConfig.key];
        const bValue = (b as any)[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, filters, sortConfig, filterable]);

  // Calculate visible rows
  const visibleRange = useMemo(() => {
    const containerHeight = height;
    const startIndex = Math.floor(scrollTop / rowHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / rowHeight) + OVERSCAN,
      processedData.length
    );

    return {
      start: Math.max(0, startIndex - OVERSCAN),
      end: endIndex
    };
  }, [scrollTop, height, rowHeight, processedData.length]);

  const visibleData = useMemo(() => {
    return processedData.slice(visibleRange.start, visibleRange.end);
  }, [processedData, visibleRange]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Handle sorting
  const handleSort = useCallback((columnKey: string) => {
    if (!sortable) return;

    setSortConfig(prev => {
      if (prev?.key === columnKey) {
        return prev.direction === 'asc'
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, [sortable]);

  // Handle filter change
  const handleFilterChange = useCallback((columnKey: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  }, []);

  // Handle row selection
  const handleRowSelect = useCallback((rowKey: string, isSelected: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(rowKey);
      } else {
        newSet.delete(rowKey);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((isSelected: boolean) => {
    if (isSelected) {
      const allKeys = processedData.map(row => String((row as any)[keyField]));
      setSelectedRows(new Set(allKeys));
    } else {
      setSelectedRows(new Set());
    }
  }, [processedData, keyField]);

  // Update parent component when selection changes
  useEffect(() => {
    if (onRowSelect) {
      const selected = processedData.filter(row =>
        selectedRows.has(String((row as any)[keyField]))
      );
      onRowSelect(selected);
    }
  }, [selectedRows, processedData, onRowSelect, keyField]);

  // Calculate total height
  const totalHeight = processedData.length * rowHeight;
  const offsetY = visibleRange.start * rowHeight;

  if (loading) {
    return (
      <div className={`border border-gray-200 dark:border-gray-700 rounded-lg ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <div className={`border border-gray-200 dark:border-gray-700 rounded-lg ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-gray-400 text-4xl mb-2">📊</div>
            <p className="text-gray-600 dark:text-gray-400">{emptyMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex">
          {selectable && (
            <div className="w-12 px-3 py-3 flex items-center justify-center border-r border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                checked={selectedRows.size === processedData.length && processedData.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          )}
          {columns.map((column) => (
            <div
              key={column.key}
              className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                column.headerClassName || ''
              } ${sortable && column.sortable !== false ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}`}
              style={{
                width: column.width,
                minWidth: column.minWidth || 100,
                maxWidth: column.maxWidth
              }}
              onClick={() => column.sortable !== false && handleSort(column.key)}
            >
              <div className="flex items-center space-x-1">
                {column.headerRender ? column.headerRender() : (
                  <span>{column.title}</span>
                )}
                {sortable && column.sortable !== false && sortConfig?.key === column.key && (
                  <span className="text-blue-600 dark:text-blue-400">
                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
              {filterable && column.filterable !== false && (
                <input
                  type="text"
                  placeholder="Filter..."
                  className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  value={filters[column.key] || ''}
                  onChange={(e) => handleFilterChange(column.key, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div
        ref={scrollElementRef}
        className="overflow-auto bg-white dark:bg-gray-900"
        style={{ height: height - (filterable ? 80 : 48) }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleData.map((row, index) => {
              const actualIndex = visibleRange.start + index;
              const rowKey = String((row as any)[keyField]);
              const isSelected = selectedRows.has(rowKey);

              return (
                <div
                  key={rowKey}
                  className={`flex border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{ height: rowHeight }}
                  onClick={() => onRowClick?.(row, actualIndex)}
                >
                  {selectable && (
                    <div className="w-12 px-3 flex items-center justify-center border-r border-gray-200 dark:border-gray-700">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleRowSelect(rowKey, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 last:border-r-0 flex items-center ${
                        column.className || ''
                      }`}
                      style={{
                        width: column.width,
                        minWidth: column.minWidth || 100,
                        maxWidth: column.maxWidth
                      }}
                    >
                      {column.render
                        ? column.render((row as any)[column.key], row, actualIndex)
                        : String((row as any)[column.key] || '')
                      }
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export { VirtualizedTable };
export default VirtualizedTable;
