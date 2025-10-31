import React, { ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  className?: string;
  mobileLabel?: string; // Label to show in mobile card view
  priority?: number; // Lower numbers show first on mobile
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  mobileCardClassName?: string;
  isLoading?: boolean;
}

export function ResponsiveTable<T>({
  data,
  columns,
  getRowKey,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
  mobileCardClassName = '',
  isLoading = false
}: ResponsiveTableProps<T>): React.JSX.Element {
  const resolveValue = (column: Column<T>, row: T): React.ReactNode => {
    if (column.render) {
      return column.render(row);
    }

    const value = (row as Record<string, unknown>)[column.key];
    return value ?? '';
  };

  // Sort columns by priority for mobile view
  const mobileColumns = columns
    .filter(col => !col.hideOnMobile)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="hidden sm:block">
          {/* Desktop skeleton */}
          <div className="bg-gray-200 dark:bg-gray-700 h-10 mb-2 rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 h-16 mb-1 rounded" />
          ))}
        </div>
        <div className="sm:hidden space-y-3">
          {/* Mobile skeleton */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className={`hidden sm:block overflow-x-auto ${className}`}>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.map(item => {
              const key = getRowKey(item);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''}
                >
                  {columns.map(column => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 whitespace-nowrap text-sm ${column.className || ''}`}
                    >
                      {resolveValue(column, item)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className={`sm:hidden space-y-3 ${mobileCardClassName}`}>
        {data.map(item => {
          const key = getRowKey(item);
          return (
            <div
              key={key}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 ${
                onRowClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
              }`}
            >
              {mobileColumns.map((column, index) => {
                const value = resolveValue(column, item);
                
                if (value === undefined || value === null || value === '') return null;

                return (
                  <div key={column.key} className={index > 0 ? 'mt-2' : ''}>
                    {column.mobileLabel && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {column.mobileLabel}:{' '}
                      </span>
                    )}
                    <span className={`${
                      index === 0 
                        ? 'font-medium text-gray-900 dark:text-white' 
                        : 'text-sm text-gray-600 dark:text-gray-300'
                    }`}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
