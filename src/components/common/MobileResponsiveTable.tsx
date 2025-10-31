import React, { ReactNode } from 'react';

interface TableColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  className?: string;
  mobileLabel?: string;
  priority?: number; // 1 = most important on mobile
  hideOnMobile?: boolean;
  align?: 'left' | 'right' | 'center';
}

interface MobileResponsiveTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  getRowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  cardClassName?: string;
  isLoading?: boolean;
  title?: string;
  actions?: ReactNode;
}

export function MobileResponsiveTable<T>({
  data,
  columns,
  getRowKey,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
  cardClassName = '',
  isLoading = false,
  title,
  actions
}: MobileResponsiveTableProps<T>): React.JSX.Element {
  const resolveValue = (column: TableColumn<T>, row: T): React.ReactNode => {
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
        {/* Desktop skeleton */}
        <div className="hidden sm:block">
          <div className="bg-gray-200 dark:bg-gray-700 h-12 mb-2 rounded-t-lg" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 h-16 mb-px" />
          ))}
        </div>
        {/* Mobile skeleton */}
        <div className="sm:hidden space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with title and actions */}
      {(title || actions) && (
        <div className="flex justify-between items-center mb-4">
          {title && <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>}
          {actions && <div>{actions}</div>}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary dark:bg-gray-700 text-white sticky top-0 z-10">
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-${column.align || 'left'} text-xs font-medium uppercase tracking-wider ${column.className || ''}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.map((item, index) => {
                const key = getRowKey(item);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    className={`
                      ${onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''}
                      ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}
                    `}
                  >
                    {columns.map(column => (
                      <td
                        key={column.key}
                        className={`px-6 py-4 text-sm text-${column.align || 'left'} ${column.className || ''}`}
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
      </div>

      {/* Mobile Card View */}
      <div className={`sm:hidden space-y-3 ${cardClassName}`}>
        {data.map(item => {
          const key = getRowKey(item);
          const primaryColumn = mobileColumns[0];
          const secondaryColumns = mobileColumns.slice(1);

          return (
            <div
              key={key}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`
                bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4
                ${onRowClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
              `}
            >
              {/* Primary info (usually the most important column) */}
              {primaryColumn && (
                <div className="mb-3">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {resolveValue(primaryColumn, item)}
                  </div>
                </div>
              )}

              {/* Secondary info in a grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {secondaryColumns.map(column => {
                  const value = resolveValue(column, item);
                  
                  if (value === undefined || value === null || value === '') return null;

                  return (
                    <div key={column.key}>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs">
                        {column.mobileLabel || column.label}
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper component for action buttons that work well on mobile
export function MobileTableActions({ 
  actions 
}: { 
  actions: Array<{ label: string; onClick: () => void; icon?: ReactNode; variant?: 'primary' | 'secondary' | 'danger' }> 
}) {
  return (
    <div className="flex gap-2">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className={`
            min-h-[44px] px-3 py-2 rounded-lg font-medium transition-colors
            ${action.variant === 'primary' 
              ? 'bg-primary text-white hover:bg-primary-dark' 
              : action.variant === 'danger'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}
          `}
        >
          <span className="flex items-center gap-2">
            {action.icon}
            <span className="hidden sm:inline">{action.label}</span>
            <span className="sm:hidden">{action.icon ? '' : action.label.slice(0, 3)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
