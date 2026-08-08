import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { VirtualizedTable, type Column, type RowDetail } from './VirtualizedTable';

/**
 * A row that carries something underneath it, in a list that is VIRTUALISED.
 *
 * This is the half of the inline quick-edit box that nothing else can prove.
 * Above fifty rows — which is every real account — the register hands its rows
 * to react-window, which positions them by arithmetic rather than by measuring
 * the DOM: every row's top is the sum of the heights above it, cached the
 * first time it is worked out. So there are exactly two ways to get this
 * wrong, and both are silent:
 *
 *   1. not making the expanded row taller, so the box is painted over by the
 *      row below it;
 *   2. making it taller but never telling react-window to forget the offsets
 *      it already cached, so the rows below keep their old positions — the box
 *      overlaps them, and moving it to another row leaves a hole where it was.
 *
 * Both are read off here as the `top` react-window writes on each row.
 *
 * WHAT IS STOOD IN FOR: AutoSizer measures its parent, and jsdom performs no
 * layout at all, so it would report 0×0 and react-window would render nothing.
 * It is replaced with a fixed 800×400 viewport — the browser API, not any of
 * the behaviour under test. What jsdom still cannot show is what the result
 * LOOKS like; that is named in the handover as a browser check.
 */

vi.mock('react-virtualized-auto-sizer', () => ({
  default: ({ children }: { children: (size: { height: number; width: number }) => React.ReactNode }) =>
    children({ height: 400, width: 800 }),
}));

interface Row {
  id: string;
  label: string;
}

const ROW_HEIGHT = 40;
const DETAIL_HEIGHT = 100;

/** Sixty rows — comfortably over the register's own fifty-row threshold. */
const ROWS: Row[] = Array.from({ length: 60 }, (_, i) => ({
  id: `row-${String(i).padStart(2, '0')}`,
  label: `Synthetic row ${String(i).padStart(2, '0')}`,
}));

const COLUMNS: Column<Row>[] = [
  { key: 'label', header: 'Label', accessor: (row) => <span>{row.label}</span> },
];

const rowDomId = (key: string): string => `test-row-${key}`;

const detailFor = (index: number): RowDetail<Row> => ({
  key: ROWS[index].id,
  height: DETAIL_HEIGHT,
  render: () => <div data-testid="row-detail">the box</div>,
});

const renderTable = (rowDetail: RowDetail<Row> | null) =>
  render(
    <VirtualizedTable
      items={ROWS}
      columns={COLUMNS}
      getItemKey={(row: Row) => row.id}
      rowDomId={rowDomId}
      rowHeight={ROW_HEIGHT}
      threshold={50}
      rowDetail={rowDetail}
    />
  );

/** Where react-window has placed the row with this index, in px from the top. */
const topOf = (index: number): number => {
  const row = document.getElementById(rowDomId(ROWS[index].id));
  if (!row) throw new Error(`row ${index} is not rendered`);
  // A row carrying a detail is wrapped (the wrapper owns react-window's slot),
  // so the positioned element is the row's parent in that one case.
  const positioned = row.style.top === '' ? row.parentElement : row;
  const top = positioned?.style.top ?? '';
  if (!top.endsWith('px')) throw new Error(`row ${index} has no position: "${top}"`);
  return Number.parseFloat(top);
};

describe('VirtualizedTable — a row with an editor under it, virtualised', () => {
  it('renders no detail, and evenly spaced rows, when nothing is expanded', () => {
    renderTable(null);

    expect(screen.queryByTestId('row-detail')).not.toBeInTheDocument();
    expect(topOf(0)).toBe(0);
    expect(topOf(1)).toBe(ROW_HEIGHT);
    expect(topOf(4)).toBe(4 * ROW_HEIGHT);
  });

  it('pushes every row below the expanded one down by exactly the detail height', () => {
    renderTable(detailFor(2));

    expect(screen.getByTestId('row-detail')).toBeInTheDocument();
    // Everything above is untouched…
    expect(topOf(1)).toBe(ROW_HEIGHT);
    expect(topOf(2)).toBe(2 * ROW_HEIGHT);
    // …and everything below has moved down by the box, not by a guess at it.
    expect(topOf(3)).toBe(3 * ROW_HEIGHT + DETAIL_HEIGHT);
    expect(topOf(4)).toBe(4 * ROW_HEIGHT + DETAIL_HEIGHT);
  });

  it('moves the gap with the box when the box moves to another row', () => {
    const { rerender } = renderTable(detailFor(2));
    expect(topOf(3)).toBe(3 * ROW_HEIGHT + DETAIL_HEIGHT);

    // Save & Next, in effect: the same list, the box one row further down.
    rerender(
      <VirtualizedTable
        items={ROWS}
        columns={COLUMNS}
        getItemKey={(row: Row) => row.id}
        rowDomId={rowDomId}
        rowHeight={ROW_HEIGHT}
        threshold={50}
        rowDetail={detailFor(5)}
      />
    );

    // The hole where the box WAS has closed…
    expect(topOf(3)).toBe(3 * ROW_HEIGHT);
    expect(topOf(4)).toBe(4 * ROW_HEIGHT);
    expect(topOf(5)).toBe(5 * ROW_HEIGHT);
    // …and opened where the box now is. Without react-window being told to
    // forget its cached offsets, these two are the assertions that fail.
    expect(topOf(6)).toBe(6 * ROW_HEIGHT + DETAIL_HEIGHT);
    expect(topOf(7)).toBe(7 * ROW_HEIGHT + DETAIL_HEIGHT);
  });

  it('keeps the detail out of the row it belongs to, and next to it', () => {
    renderTable(detailFor(2));

    const rows = screen.getAllByRole('row');
    const transactionRow = document.getElementById(rowDomId(ROWS[2].id));
    const detailRow = screen.getByTestId('row-detail').closest('[role="row"]');

    // Two rows, not one: the transaction's cells stay the transaction's, and
    // the box gets a row of its own holding a single cell. A form nested
    // inside a row of gridcells would be a structure nothing can read.
    expect(detailRow).not.toBe(transactionRow);
    expect(rows.indexOf(detailRow as HTMLElement)).toBe(rows.indexOf(transactionRow as HTMLElement) + 1);
    expect(within(detailRow as HTMLElement).getByRole('gridcell')).toBeInTheDocument();
  });
});
