import React from 'react';

/**
 * The shape of one column, exactly as the table itself declares it — a
 * `Column<T>` satisfies this structurally, so the placeholder is measured off
 * the real column list rather than a second copy of it that can drift.
 */
export interface TableSkeletonColumn {
  key: string;
  width?: string | number;
  className?: string;
}

interface TableSkeletonProps {
  columns: TableSkeletonColumn[];
  /** The REAL row height of the table this stands in for, in px. */
  rowHeight: number;
  /** Three is the maximum that says "rows are coming" (DESIGN_PASS §4). */
  rows?: number;
  className?: string;
}

/** Row 1 solid, then away — "fading down", so it reads as a hint, not data. */
const ROW_OPACITY = [1, 0.66, 0.33];

/**
 * SHAPE, NOT SPINNER (DESIGN_PASS §4).
 *
 * Skeleton rows at the real row height and the real column widths, so nothing
 * moves when the figures arrive — a placeholder of the wrong size is a layout
 * shift with extra steps.
 *
 * AND NO PULSING. Every skeleton in the wild breathes; a twenty-row register
 * that breathes is nauseating, and on a virtualised list it burns a repaint of
 * every visible row, every frame, on rows that are about to be thrown away.
 * One 200ms fade-in when it appears is the whole of the animation budget.
 */
export function TableSkeleton({
  columns,
  rowHeight,
  rows = 3,
  className = ''
}: TableSkeletonProps): React.JSX.Element {
  const count = Math.min(rows, ROW_OPACITY.length);

  return (
    <div
      role="status"
      aria-label="Loading transactions"
      className={`animate-fade-in motion-reduce:animate-none ${className}`}
    >
      {Array.from({ length: count }, (_, rowIndex) => (
        <div
          key={rowIndex}
          style={{ height: rowHeight, opacity: ROW_OPACITY[rowIndex] }}
          // The same hairline the real table rules its rows with, so nothing
          // shifts when the data arrives.
          className="flex items-center border-b border-line-soft dark:border-gray-700"
          aria-hidden="true"
        >
          {columns.map(column => (
            <div
              key={column.key}
              style={{ width: column.width }}
              className={`px-3 overflow-hidden ${column.className || ''}`}
            >
              <span className="inline-block h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
