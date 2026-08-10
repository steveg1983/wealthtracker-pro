import React, { memo, useMemo, useState, ReactNode, useCallback } from 'react';
import { VirtualizedList } from './VirtualizedList';
import { useRowClickGesture, ROW_EDITOR_CELL_ATTRIBUTE } from '../hooks/useRowClickGesture';

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

/**
 * An editor (or anything else) attached to ONE row: cells of its own inside
 * that row, and a strip immediately beneath it that displaces every row below.
 * Microsoft Money's inline transaction form, and the shape the register's quick
 * edit takes.
 *
 * The heights travel with the render functions on purpose: a key with no height
 * would leave the virtualised list doing its row maths against a row it cannot
 * measure. They are therefore NUMBERS of pixels, and the detail must honour
 * them — react-window positions rows by arithmetic, not by measuring the DOM,
 * so a detail that grew taller than it declared would be painted over by the
 * row beneath it.
 */
export interface RowDetail<T> {
  /** The key (see getItemKey) of the row the detail belongs to. */
  key: string;
  /** Exactly how tall the strip beneath the row is, in px. */
  height: number;
  /**
   * What the row's OWN line is worth while it carries this detail, in px.
   * Defaults to the table's rowHeight.
   *
   * A detail that merely hangs beneath its row leaves the row alone. One that
   * has turned the row's cells INTO the editor needs the line taller than a
   * line of text — and the arithmetic has to be told, because a row that
   * quietly grew is a row the ones below it are painted over by.
   */
  rowHeight?: number;
  /**
   * What ONE cell holds while the row carries this detail — or undefined to
   * leave the column's own accessor in charge of it.
   *
   * This is what lets the row ITSELF be the editor rather than a caption above
   * one: the input sits in the cell whose value it edits, under the same
   * column header, at the same width. Alignment by construction, rather than
   * two layouts kept in step by hand.
   */
  renderCell?: (columnKey: string, item: T) => ReactNode | undefined;
  /** The strip beneath the row. */
  render: (item: T) => ReactNode;
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
  /** Key of a row to bring into view — the deep-link jump. */
  scrollToKey?: string | null;
  /** How to place that row: centred (default) or the least scroll that shows it. */
  scrollToAlign?: 'center' | 'nearest';
  /**
   * A count that says "asked again". Change it — leaving scrollToKey and
   * scrollToAlign alone — to re-issue the SAME request, which is how a caller
   * re-centres a row the user has since scrolled away from. See VirtualizedList.
   */
  scrollToToken?: number;
  /** A pulse asking the list to park at its foot. See VirtualizedList. */
  scrollToBottomToken?: number;
  /**
   * Opt-in ARIA grid semantics, for a table an owning container drives from
   * the keyboard. Supply it and every row renders as role="row" carrying this
   * DOM id — so the owner can point aria-activedescendant at the active row,
   * the pattern this codebase's comboboxes already use — with its cells as
   * gridcells and the header as a row of columnheaders. Leave it off and the
   * markup is byte-for-byte what it was.
   */
  rowDomId?: (rowKey: string) => string;
  /** See RowDetail — an editor drawn under one row, pushing the rest down. */
  rowDetail?: RowDetail<T> | null;
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
  onColumnResize,
  gridSemantics = false
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
  /** See VirtualizedTableProps.rowDomId — the header half of the same opt-in. */
  gridSemantics?: boolean;
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
    <div
      role={gridSemantics ? 'row' : undefined}
      className={`flex items-center border-b border-gray-300 dark:border-gray-500 ${headerClassName || 'bg-gray-100 dark:bg-gray-700'}`}
    >
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
            role={gridSemantics ? 'columnheader' : undefined}
            // Which way this column is sorted, announced rather than left to
            // the ↑/↓ glyph a screen reader cannot interpret.
            aria-sort={
              !gridSemantics || !column.sortable || !onSort
                ? undefined
                : sortColumn === column.key
                  ? (sortDirection === 'desc' ? 'descending' : 'ascending')
                  : 'none'
            }
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
  onColumnResize,
  scrollToKey,
  scrollToAlign,
  scrollToToken,
  scrollToBottomToken,
  rowDomId,
  rowDetail
}: VirtualizedTableProps<T>) {
  // Resolve the deep-link key to its position in the CURRENT row order, so
  // the list can centre it regardless of sort or filters.
  const scrollToIndex = useMemo(() => {
    if (!scrollToKey) return undefined;
    const index = items.findIndex((item, i) => getItemKey(item, i) === scrollToKey);
    return index >= 0 ? index : undefined;
  }, [items, getItemKey, scrollToKey]);

  // Which row is carrying the detail right now, or -1 for none. Resolved
  // against the CURRENT order, like the scroll target above, so a re-sort moves
  // the detail with its row rather than stranding it on whatever now sits at
  // that position.
  const detailIndex = useMemo(() => {
    if (!rowDetail) return -1;
    return items.findIndex((item, i) => getItemKey(item, i) === rowDetail.key);
  }, [items, getItemKey, rowDetail]);

  /**
   * The height of each row: the ordinary one, plus the detail on the one row
   * that carries it.
   *
   * ─ WHY A TABLE THAT CAN EXPAND STAYS A FUNCTION EVEN WHEN NOTHING IS ────────
   * VirtualizedList picks between react-window's two list components by asking
   * whether this is a number or a function. They are DIFFERENT COMPONENT TYPES,
   * so going from one to the other unmounts the scroll container and mounts a
   * fresh one — and a fresh list is at offset zero, the top of the register.
   *
   * That was the owner's bug: "Sometimes when I update the category and then
   * press 'save & next', I get kicked back to the start of the transaction
   * list, which for my oldest current account is 2008." Every way of
   * putting the quick-edit box away — Escape, the ×, the Save that ends a run,
   * opening the full editor over it — took the row's extra height away with it,
   * turned this back into a number, and teleported eleven thousand rows to
   * 2008. It looked intermittent because the ways that OPEN the box also ask
   * for a row to be scrolled to, which hid the jump by immediately correcting
   * it; the ways that CLOSE it ask for nothing, so the top is where you stayed.
   *
   * So the shape is decided by whether this table can expand a row AT ALL —
   * which is what passing the rowDetail prop says, null or not — and never by
   * whether one happens to be expanded this second. Tables that never pass it
   * keep the cheaper fixed-size list exactly as before.
   */
  const canExpandRows = rowDetail !== undefined;
  const itemHeight = useMemo<number | ((index: number) => number)>(() => {
    if (!canExpandRows) return rowHeight;
    // detailIndex is -1 when nothing is expanded, and also when the expanded
    // row is not in the current list (a filter hid it) — in both cases every
    // row is its ordinary height, and no row is a special case.
    const expanded = detailIndex >= 0 && rowDetail
      // The row's own line (taller while its cells are the editor) plus the
      // strip beneath it. Both come from the detail; neither is guessed at.
      ? (rowDetail.rowHeight ?? rowHeight) + rowDetail.height
      : rowHeight;
    return (index: number): number => (index === detailIndex ? expanded : rowHeight);
  }, [canExpandRows, detailIndex, rowDetail, rowHeight]);

  // Where the mouse went DOWN, so a click the browser synthesised on the row
  // from a drag that began in one of its own boxes is not mistaken for someone
  // clicking the row. See useRowClickGesture for the whole of the reasoning.
  const { rowGestureProps, isSelectionTail } = useRowClickGesture();

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
      // A drag that began in one of the row's own boxes and was released
      // elsewhere in the row arrives here as a click ON THE ROW — the browser
      // dispatches a click on the common ancestor of where the button went down
      // and where it came up. That is someone selecting text, not clicking a
      // row, and it must leave the row entirely alone: anything that changed
      // state here would re-render and take the focus, which collapses the very
      // selection they were making.
      if (isSelectionTail()) return;
      if (onRowClick) {
        onRowClick(item, index);
      }
    };

    const computedRowClassName = typeof rowClassName === 'function' 
      ? rowClassName(item, index) 
      : rowClassName || '';

    const isEditorRow = !!rowDetail && index === detailIndex;
    const detail = isEditorRow && rowDetail ? rowDetail.render(item) : null;

    const baseRowClass = 'flex items-center border-b border-gray-200 dark:border-gray-700 transition-colors duration-150';
    const clickableClass = onRowClick ? 'cursor-pointer select-none' : '';
    // Only apply hover effects if not selected. No scale: these rows sit in
    // an overflow-clipped table, and a 1.01 scale pushed the rightmost
    // column's digits past the edge — the shadow and z-lift suffice.
    const hoverClass = onRowClick && !isSelected ? 'hover:shadow-[0_-6px_10px_-2px_rgba(0,0,0,0.15),0_6px_10px_-2px_rgba(0,0,0,0.15)] hover:z-10 hover:bg-gray-50 dark:hover:bg-gray-800' : '';
    // Don't apply stripe classes to selected rows
    const stripeClass = !isSelected && index % 2 === 1 ? 'bg-gray-100 dark:bg-gray-800/50' : !isSelected ? 'bg-white dark:bg-gray-900' : '';

    // With a detail below it the row no longer owns react-window's slot: the
    // wrapper does, and the row keeps exactly its own height so the detail gets
    // the rest. That height is the detail's to declare — a row whose cells have
    // become inputs is taller than a line of text — and it is declared here
    // even on the non-virtualised path, where rows otherwise size to their own
    // content: the same number has to be true on both paths, because the
    // register's scroll arithmetic reads it back off the DOM on one of them.
    const lineHeight = rowDetail?.rowHeight ?? (style.height === undefined ? undefined : rowHeight);

    const rowLine = (
      <div
        style={detail ? { height: lineHeight, overflow: 'visible' } : { ...style, overflow: 'visible' }}
        id={rowDomId?.(itemKey)}
        role={rowDomId ? 'row' : undefined}
        aria-selected={rowDomId ? isSelected : undefined}
        className={`${baseRowClass} ${stripeClass} ${clickableClass} ${!isSelected ? hoverClass : ''} ${computedRowClassName}`}
        onClick={handleRowClick}
        {...rowGestureProps}
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

        {columns.map((column) => {
          // The editor's own cell, where it has one. undefined is "not mine",
          // and is not the same as null — a detail is entitled to empty a cell.
          const edited = isEditorRow && rowDetail?.renderCell
            ? rowDetail.renderCell(column.key, item)
            : undefined;
          return (
            <div
              key={column.key}
              role={rowDomId ? 'gridcell' : undefined}
              // Marked so a press that lands anywhere in a cell the detail has
              // taken over — the box, or the sliver of cell around it — counts
              // as starting in the editor rather than on the row. Spread rather
              // than passed a value, so every OTHER cell is left without the
              // attribute at all rather than wearing an empty one.
              {...(edited === undefined ? {} : { [ROW_EDITOR_CELL_ATTRIBUTE]: '' })}
              className={`px-3 py-2 overflow-hidden ${column.className || ''}`}
              style={{ width: column.width }}
            >
              {edited === undefined ? column.accessor(item) : edited}
            </div>
          );
        })}
      </div>
    );

    if (!detail || !rowDetail) return rowLine;

    // grid → rowgroup → row → gridcell: the strip is a row of the grid in its
    // own right, holding one cell that spans the table. Anything looser (a bare
    // div between the grid and its rows) is a structure a screen reader is
    // entitled to ignore, and it would take the transaction row with it.
    //
    // No onClick on the wrapper: clicking inside the strip must never count as
    // clicking the row, which would open the full modal over the editor the
    // user is working in. The cells the detail has taken over sit INSIDE the
    // row, where the row's own onClick can reach them, so they stop their own
    // clicks — see the register's field cells.
    return (
      <div
        style={{ ...style, overflow: 'visible' }}
        role={rowDomId ? 'rowgroup' : undefined}
        className="flex flex-col"
      >
        {rowLine}
        <div
          role={rowDomId ? 'row' : undefined}
          style={{ height: rowDetail.height }}
          className="shrink-0"
        >
          <div role={rowDomId ? 'gridcell' : undefined} className="h-full">
            {detail}
          </div>
        </div>
      </div>
    );
  }, [
    columns,
    getItemKey,
    onRowClick,
    rowClassName,
    selectedItems,
    onSelectionChange,
    showCheckbox,
    rowDomId,
    rowDetail,
    detailIndex,
    rowHeight,
    rowGestureProps,
    isSelectionTail
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
          gridSemantics={!!rowDomId}
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
        gridSemantics={!!rowDomId}
      />

      <VirtualizedList
        items={items}
        renderItem={renderRow as (item: unknown, index: number, style: React.CSSProperties) => React.ReactElement}
        getItemKey={getItemKey as (item: unknown, index: number) => string}
        itemHeight={itemHeight}
        // What react-window should assume about rows it has not measured yet.
        // Left at its 80px default it was guessing nearly twice the truth for a
        // 44px register, which skews the total height — and with it every offset
        // computed from the end of the list, including where "centre this row"
        // lands. The rows are all this tall; say so.
        estimatedItemSize={rowHeight}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
        threshold={threshold}
        scrollToIndex={scrollToIndex}
        scrollToAlign={scrollToAlign}
        scrollToToken={scrollToToken}
        scrollToBottomToken={scrollToBottomToken}
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
