import React, { ReactNode } from 'react';
import { TableSkeleton } from '../loading/TableSkeleton';
import { useDelayedFlag } from '../../hooks/useDelayedFlag';
import { ABSENT_VALUE, DESKTOP_ROW_HEIGHT, mobileRowHeight } from './responsiveTableMetrics';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  className?: string;
  /** Label to show in mobile card view. Without one the field is the row's headline. */
  mobileLabel?: string;
  /** Lower numbers show first on mobile. */
  priority?: number;
  hideOnMobile?: boolean;
  /** Real column width — also what the loading placeholder is measured from. */
  width?: string | number;
  /**
   * THIS COLUMN HOLDS A FIGURE.
   *
   * How the component knows, and it has to be told: alignment lived in
   * `className: 'text-right'` before this, which is a class for a `<td>` and
   * therefore says nothing on a phone, where there is no table cell to align
   * inside. So the mobile tree had no way to find the amounts and didn't try —
   * every field came out as an inline span and P5 ("numbers line up or they
   * lie") held on no phone, on any table using this component.
   *
   * One flag, read by BOTH trees, so they cannot drift: the desktop cell gets
   * right-alignment and tabular figures, the mobile row gets label-left /
   * figure-right and the same tabular figures. The colour is left alone on
   * purpose — income/expense comes from the caller's own `render`, and this
   * flag is about where a number sits, never what it means.
   */
  numeric?: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  /**
   * What stands where the rows would be when there are none — REQUIRED, and a
   * node rather than a string.
   *
   * It was `emptyMessage?: string`, rendered centred and grey with no remedy
   * and no filtered-empty path of any kind, which meant this component could
   * not express the distinction batch 7 made law: "no transactions" and "no
   * transactions MATCH YOUR FILTERS" are different facts, and a finance app
   * that renders the second as the first has told the user their money is
   * gone. A string prop cannot say the second one, so the string prop is gone.
   *
   * Required for the same reason `InfiniteScrollTransactionList` requires it:
   * with a default, "which of the two is this?" is a question a caller can
   * skip, and the skipped answer is always the alarming one.
   *
   * WHICH of the pair to pass is the caller's to decide, on the count of rows
   * that exist BEFORE filtering — never on `data`, which is empty in both
   * cases. That is the shape every shipped surface uses (AccountTransactions,
   * AuditLogs, PayeeCleanup):
   *
   *   emptyContent={total === 0
   *     ? <EmptyState title="…" description="…" action={…} />
   *     : <FilteredEmptyState hiddenCount={total} filters={names} onClear={…} />}
   */
  emptyContent: ReactNode;
  className?: string;
  mobileCardClassName?: string;
  isLoading?: boolean;
  /** What the loading placeholder announces to a screen reader. */
  loadingLabel?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  getRowKey,
  onRowClick,
  emptyContent,
  className = '',
  mobileCardClassName = '',
  isLoading = false,
  loadingLabel = 'Loading rows'
}: ResponsiveTableProps<T>): React.JSX.Element {
  // "Under 200ms: show nothing" (DESIGN_PASS §4) — a placeholder that appears
  // for 80ms and vanishes makes a fast table look like a slow one.
  const showSkeleton = useDelayedFlag(isLoading);

  /**
   * One cell: what to draw, and whether the caller had anything to draw.
   *
   * Both answers come back together because `render` belongs to the caller and
   * must be run ONCE per cell — asking "is this empty?" and "what is it?" as
   * two questions calls it twice, which doubles the work on every cell of
   * every row and quietly assumes the caller's function is pure.
   *
   * Absence is only knowable for the values that are genuinely absent — an
   * empty string, null, undefined. A node that happens to render nothing is
   * the caller's business, and guessing at it would mean reaching inside
   * somebody else's JSX.
   */
  const resolveCell = (
    column: Column<T>,
    row: T
  ): { node: React.ReactNode; absent: boolean } => {
    if (column.render) {
      const rendered = column.render(row);
      const absent = rendered === undefined || rendered === null || rendered === '';
      return { node: absent ? ABSENT_VALUE : rendered, absent };
    }
    const value = (row as Record<string, unknown>)[column.key];
    const absent = value === undefined || value === null || value === '';
    return { node: absent ? ABSENT_VALUE : <>{value}</>, absent };
  };

  // Sort columns by priority for mobile view.
  const mobileColumns = columns
    .filter(col => !col.hideOnMobile)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  if (isLoading) {
    if (!showSkeleton) return <></>;

    return (
      <>
        {/* WAS a five-row `animate-pulse` block with desktop rows at h-16 — a
            height the table has never had, so the content jumped on arrival,
            and a pulse the rules named specifically. TableSkeleton stands at
            the real row height, over the real column widths, three rows, one
            200ms fade and nothing else. */}
        <div className={`hidden sm:block ${className}`}>
          <TableSkeleton
            columns={columns}
            rowHeight={DESKTOP_ROW_HEIGHT}
            label={loadingLabel}
          />
        </div>
        <div className={`sm:hidden ${mobileCardClassName}`}>
          <TableSkeleton
            columns={[{ key: 'row', className: 'flex-1' }]}
            rowHeight={mobileRowHeight(mobileColumns.length)}
            label={loadingLabel}
          />
        </div>
      </>
    );
  }

  if (data.length === 0) {
    return <>{emptyContent}</>;
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className={`hidden sm:block overflow-x-auto ${className}`}>
        <table className="w-full">
          {/* The chrome reduction the register got by hand and this shared
              table never did (DESIGN_PASS §3.1): the filled `bg-gray-50` block
              becomes a caps label strip on #f8f9fb over one hairline, and
              `px-6 py-4` becomes the 12px dense padding. `whitespace-nowrap`
              came off every cell with it — it was forcing a horizontal scroll
              on to content that would rather wrap. */}
          <thead className="bg-surface-secondary dark:bg-gray-700 sticky top-0 z-10 border-b border-line dark:border-gray-600">
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  scope="col"
                  style={{ width: column.width }}
                  className={`px-3 py-2 text-label uppercase font-medium text-gray-600 dark:text-gray-300 ${
                    column.numeric ? 'text-right' : 'text-left'
                  } ${column.className || ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {data.map(item => {
              const key = getRowKey(item);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={`border-b border-line-soft dark:border-gray-700 ${
                    onRowClick ? 'cursor-pointer hover:bg-surface-secondary dark:hover:bg-gray-700' : ''
                  }`}
                >
                  {columns.map(column => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 text-body ${
                        column.numeric ? 'text-right tabular-nums' : ''
                      } ${column.className || ''}`}
                    >
                      {resolveCell(column, item).node}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className={`sm:hidden ${mobileCardClassName}`}>
        {data.map(item => {
          const key = getRowKey(item);
          return (
            <div
              key={key}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              style={{ minHeight: mobileRowHeight(mobileColumns.length) }}
              // WAS `bg-white rounded-lg shadow-sm p-4` per row with
              // `active:scale-[0.98]` — the card treatment retired from
              // Accounts and reconciliation, and a shrink-on-tap that reads as
              // a button when the row navigates. Hairline rows, same as the
              // desktop tree it sits beside.
              className={`space-y-1 px-4 py-3 border-b border-line-soft dark:border-gray-700 ${
                onRowClick ? 'cursor-pointer active:bg-surface-secondary dark:active:bg-gray-700' : ''
              }`}
            >
              {mobileColumns.map(column => {
                // NEVER OMIT A FIELD WHOSE SIBLINGS SHOW IT. This returned
                // null for an empty value, so a field with no data vanished
                // and two rows came out with different shapes — leaving a
                // reader unable to tell "no data" from "not applicable" from
                // "I scrolled past it". The row is always the same row; the
                // absence is what's marked.
                const { node: value, absent } = resolveCell(column, item);

                // No mobileLabel: this field IS the row's headline, and takes
                // the full width rather than being squeezed against a label.
                if (!column.mobileLabel) {
                  return (
                    <div
                      key={column.key}
                      className={`text-body font-medium truncate ${
                        absent ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                      } ${column.numeric ? 'tabular-nums' : ''}`}
                    >
                      {value}
                    </div>
                  );
                }

                return (
                  <div key={column.key} className="flex items-baseline justify-between gap-3">
                    <span className="text-body text-gray-500 dark:text-gray-400 shrink-0">
                      {column.mobileLabel}
                    </span>
                    {/* The figure sits hard right with tabular figures, so a
                        column of them lines up down the card stack exactly as
                        it does down a desktop column (P5). No colour is set
                        here: income/expense arrives inside the caller's own
                        `render` and is left to say what it means. */}
                    <span
                      className={`text-body text-right truncate ${
                        column.numeric ? 'tabular-nums' : ''
                      } ${absent ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}
                    >
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
