import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  className?: string;
  ariaLabel?: (item: T) => string;
}

interface AccessibleTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowKey: (item: T) => string;
  onSort?: (key: string) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  caption: string;
  onRowClick?: (item: T) => void;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  className?: string;
  emptyMessage?: string;
}

export function AccessibleTable<T>({
  data,
  columns,
  getRowKey,
  onSort,
  sortField,
  sortDirection,
  caption,
  onRowClick,
  selectedRows,
  onSelectionChange,
  className = '',
  emptyMessage = 'No data available'
}: AccessibleTableProps<T>): React.JSX.Element {
  const handleRowKeyDown = (e: React.KeyboardEvent, item: T) => {
    if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
      e.preventDefault();
      onRowClick(item);
    }
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent, column: Column<T>) => {
    if ((e.key === 'Enter' || e.key === ' ') && column.sortable && onSort) {
      e.preventDefault();
      onSort(column.key);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    
    if (e.target.checked) {
      const allKeys = new Set(data.map(getRowKey));
      onSelectionChange(allKeys);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (key: string, checked: boolean) => {
    if (!onSelectionChange || !selectedRows) return;
    
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(key);
    } else {
      newSelected.delete(key);
    }
    onSelectionChange(newSelected);
  };

  const isAllSelected = selectedRows && data.length > 0 && 
    data.every(item => selectedRows.has(getRowKey(item)));

  return (
    <div role="region" aria-label={caption} className={className}>
      <table className="w-full" role="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr role="row">
            {onSelectionChange && (
              <th 
                scope="col" 
                className="px-4 py-2"
                role="columnheader"
              >
                <input
                  type="checkbox"
                  checked={isAllSelected || false}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                  className="rounded"
                />
              </th>
            )}
            {columns.map(column => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-2 text-left ${column.className || ''} ${
                  column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''
                }`}
                role="columnheader"
                aria-sort={
                  sortField === column.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                tabIndex={column.sortable ? 0 : -1}
                onClick={column.sortable && onSort ? () => onSort(column.key) : undefined}
                onKeyDown={column.sortable ? (e) => handleHeaderKeyDown(e, column) : undefined}
                aria-label={`${column.label} column${
                  column.sortable ? ', sortable' : ''
                }${
                  sortField === column.key
                    ? `, sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}`
                    : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  {column.label}
                  {column.sortable && sortField === column.key && (
                    <span aria-hidden="true">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (onSelectionChange ? 1 : 0)}
                className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => {
              const key = getRowKey(item);
              const isSelected = selectedRows?.has(key) || false;
              
              return (
                <tr
                  key={key}
                  role="row"
                  tabIndex={onRowClick ? 0 : -1}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  onKeyDown={onRowClick ? (e) => handleRowKeyDown(e, item) : undefined}
                  className={`border-b border-gray-200 dark:border-gray-700 ${
                    onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''
                  } ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  aria-rowindex={index + 2} // +2 because header is row 1
                >
                  {onSelectionChange && (
                    <td className="px-4 py-2" role="cell">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(key, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select row ${index + 1}`}
                        className="rounded"
                      />
                    </td>
                  )}
                  {columns.map(column => (
                    <td
                      key={column.key}
                      className={`px-4 py-2 ${column.className || ''}`}
                      role="cell"
                    >
                      {column.render ? column.render(item) : String((item as Record<string, unknown>)[column.key] || '')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}