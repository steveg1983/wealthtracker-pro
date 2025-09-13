import React, { useEffect, memo } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface ColumnConfig {
  label: string;
  sortable: boolean;
  className?: string;
}

interface TransactionTableHeaderProps {
  columnOrder: string[];
  columnWidths: Record<string, number>;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  compactView: boolean;
  isResizing: string | null;
  draggedColumn: string | null;
  dragOverColumn: string | null;
  onSort: (field: string) => void;
  onMouseDown: (column: string, e: React.MouseEvent) => void;
  onDragStart: (column: string, e: React.DragEvent) => void;
  onDragOver: (column: string, e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (column: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
}

const columnConfig: Record<string, ColumnConfig> = {
  date: { label: 'Date', sortable: true, className: 'text-left' },
  reconciled: { label: '✓', sortable: false, className: 'text-center' },
  account: { label: 'Account', sortable: true, className: 'text-left' },
  description: { label: 'Description', sortable: true, className: 'text-left' },
  category: { label: 'Category', sortable: true, className: 'text-left hidden sm:table-cell' },
  amount: { label: 'Amount', sortable: true, className: 'text-right' },
  actions: { label: 'Actions', sortable: false, className: 'text-right' }
};

export const TransactionTableHeader = memo(function TransactionTableHeader({
  columnOrder,
  columnWidths,
  sortField,
  sortDirection,
  compactView,
  isResizing,
  draggedColumn,
  dragOverColumn,
  onSort,
  onMouseDown,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}: TransactionTableHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('TransactionTableHeader component initialized', {
      componentName: 'TransactionTableHeader'
    });
  }, []);

  const renderHeaderCell = (columnKey: string) => {
    const config = columnConfig[columnKey];
    if (!config) return null;

    const isDragging = draggedColumn === columnKey;
    const isDragOver = dragOverColumn === columnKey;

    return (
      <th
        key={columnKey}
        className={`
          relative select-none
          ${compactView ? 'px-3 py-2' : 'px-6 py-3'}
          text-sm font-semibold text-white dark:text-gray-200
          ${config.className}
          ${config.sortable ? 'cursor-pointer hover:bg-secondary-dark dark:hover:bg-gray-800' : ''}
          ${isDragOver ? 'bg-primary/20 dark:bg-primary/10' : ''}
          ${isDragging ? 'opacity-50' : ''}
          transition-all duration-150
        `}
        onClick={config.sortable ? () => onSort(columnKey) : undefined}
        style={{ width: columnWidths[columnKey as keyof typeof columnWidths] }}
        draggable={!isResizing}
        onDragStart={(e) => onDragStart(columnKey, e)}
        onDragOver={(e) => onDragOver(columnKey, e)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(columnKey, e)}
        onDragEnd={onDragEnd}
        role="columnheader"
        aria-sort={
          sortField === columnKey
            ? sortDirection === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
      >
        <div className="flex items-center justify-between">
          <span className={isDragOver ? 'transform scale-110' : ''}>
            {config.label}
          </span>
          {config.sortable && sortField === columnKey && (
            <span className="ml-1 inline-block">
              {sortDirection === 'asc' ? (
                <ChevronUpIcon size={14} className="inline" />
              ) : (
                <ChevronDownIcon size={14} className="inline" />
              )}
            </span>
          )}
        </div>
        <div 
          className="absolute right-0 top-0 bottom-0 w-px cursor-col-resize bg-[#5A729A] dark:bg-gray-600"
          onMouseDown={(e) => onMouseDown(columnKey, e)}
        />
      </th>
    );
  };

  return (
    <thead className="bg-secondary dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600 sticky top-0 z-10">
      <tr role="row">
        {columnOrder.map(renderHeaderCell)}
      </tr>
    </thead>
  );
});