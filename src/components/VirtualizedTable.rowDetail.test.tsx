import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { VirtualizedTable, type Column, type RowDetail } from './VirtualizedTable';

/**
 * A row that carries an editor — cells of its own, and a strip beneath — in a
 * list that is VIRTUALISED.
 *
 * This is the half of the register's inline editing that nothing else can
 * prove. Above fifty rows — which is every real account — the register hands
 * its rows to react-window, which positions them by arithmetic rather than by
 * measuring the DOM: every row's top is the sum of the heights above it, cached
 * the first time it is worked out. So there are exactly three ways to get this
 * wrong, and all of them are silent:
 *
 *   1. not making the expanded row taller, so the strip is painted over by the
 *      row below it;
 *   2. counting the strip but not the row's own line, which now GROWS while its
 *      cells are inputs — the same overlap, a smaller one;
 *   3. making it taller but never telling react-window to forget the offsets
 *      it already cached, so the rows below keep their old positions — the
 *      strip overlaps them, and moving it to another row leaves a hole where it
 *      was.
 *
 * All three are read off here as the `top` react-window writes on each row.
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
  note: string;
}

const ROW_HEIGHT = 40;
const DETAIL_HEIGHT = 100;
/** What a row's own line is worth while its cells are the editor. */
const EDITING_ROW_HEIGHT = 56;

/** Sixty rows — comfortably over the register's own fifty-row threshold. */
const ROWS: Row[] = Array.from({ length: 60 }, (_, i) => ({
  id: `row-${String(i).padStart(2, '0')}`,
  label: `Synthetic row ${String(i).padStart(2, '0')}`,
  note: `Synthetic note ${String(i).padStart(2, '0')}`,
}));

const COLUMNS: Column<Row>[] = [
  { key: 'label', header: 'Label', accessor: (row) => <span>{row.label}</span> },
  { key: 'note', header: 'Note', accessor: (row) => <span>{row.note}</span> },
];

const rowDomId = (key: string): string => `test-row-${key}`;

const detailFor = (index: number): RowDetail<Row> => ({
  key: ROWS[index].id,
  height: DETAIL_HEIGHT,
  render: () => <div data-testid="row-detail">the strip</div>,
});

/** A detail that takes the row's Label cell over, and grows the row for it. */
const editorFor = (index: number): RowDetail<Row> => ({
  ...detailFor(index),
  rowHeight: EDITING_ROW_HEIGHT,
  renderCell: (columnKey) =>
    columnKey === 'label' ? <input data-testid="row-editor-field" defaultValue="typed" /> : undefined,
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
    // the strip gets a row of its own holding a single cell. A form nested
    // inside a row of gridcells would be a structure nothing can read.
    expect(detailRow).not.toBe(transactionRow);
    expect(rows.indexOf(detailRow as HTMLElement)).toBe(rows.indexOf(transactionRow as HTMLElement) + 1);
    expect(within(detailRow as HTMLElement).getByRole('gridcell')).toBeInTheDocument();
  });
});

/**
 * Selecting text in a row's editor, when the mouse comes up outside it.
 *
 * A browser dispatches `click` on the nearest COMMON ANCESTOR of where the
 * button went down and where it came up — so a drag that starts in a field and
 * ends anywhere else in the same row arrives as a click ON THE ROW, with the
 * row as its target. A cell that stops its own clicks cannot help: the click it
 * would have stopped was never aimed at it.
 *
 * This is the table's half of the guarantee — the register's own case is in
 * AccountTransactions.inlineEdit.test.tsx — and it is here so the mechanism
 * stays true for ANY list that gives a row both a click and an editor.
 *
 * WHAT JSDOM CANNOT DO: no pointer, so it never synthesises the ancestor click
 * itself. The sequence a browser would produce is dispatched by hand.
 */
describe('VirtualizedTable — a drag out of a row editor is not a row click', () => {
  const renderClickable = (rowDetail: RowDetail<Row> | null, onRowClick: (row: Row) => void) =>
    render(
      <VirtualizedTable
        items={ROWS}
        columns={COLUMNS}
        getItemKey={(row: Row) => row.id}
        rowDomId={rowDomId}
        rowHeight={ROW_HEIGHT}
        threshold={50}
        rowDetail={rowDetail}
        onRowClick={onRowClick}
      />
    );

  const rowElement = (index: number): HTMLElement => {
    const row = document.getElementById(rowDomId(ROWS[index].id));
    if (!row) throw new Error(`row ${index} is not rendered`);
    return row;
  };

  it('ignores a click the browser made out of a drag that began in the editor', () => {
    const onRowClick = vi.fn();
    renderClickable(editorFor(2), onRowClick);

    const field = screen.getByTestId('row-editor-field');
    const row = rowElement(2);

    fireEvent.mouseDown(field);
    fireEvent.mouseUp(row);
    fireEvent.click(row);

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('ignores one that began in the sliver of CELL around the editor', () => {
    const onRowClick = vi.fn();
    renderClickable(editorFor(2), onRowClick);

    // The cell an editor has taken over belongs to the editor, edge to edge:
    // an editor is entitled to inset its control, and the pixels it leaves are
    // not the row's to open something over.
    const cell = screen.getByTestId('row-editor-field').closest('[role="gridcell"]');
    if (!cell) throw new Error('the editor field is not in a cell of the grid');
    fireEvent.mouseDown(cell);
    fireEvent.mouseUp(rowElement(2));
    fireEvent.click(rowElement(2));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('takes every other click, on the editing row and on the rest of them', () => {
    const onRowClick = vi.fn();
    renderClickable(editorFor(2), onRowClick);

    // The same shape of click — down in one place, up in another, dispatched on
    // the row — but begun on a cell the editor never took. Only the origin
    // differs, which is the whole of the distinction.
    const plainCell = within(rowElement(2)).getByText(ROWS[2].note);
    fireEvent.mouseDown(plainCell);
    fireEvent.mouseUp(rowElement(2));
    fireEvent.click(rowElement(2));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0]).toEqual(ROWS[2]);

    // And a row that is not the editor at all is untouched by any of this.
    fireEvent.mouseDown(rowElement(4));
    fireEvent.click(rowElement(4));
    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick.mock.calls[1][0]).toEqual(ROWS[4]);
  });

  it('spends each press on one click only, so a swallowed click leaves nothing behind', () => {
    const onRowClick = vi.fn();
    renderClickable(editorFor(2), onRowClick);

    // A press and release INSIDE the field: the click targets the field, and a
    // register's cell stops it there. The press must not survive that to answer
    // for the next click, which is a real one.
    const field = screen.getByTestId('row-editor-field');
    fireEvent.mouseDown(field);
    fireEvent.mouseUp(field);
    fireEvent.click(field);
    expect(onRowClick).not.toHaveBeenCalled();

    fireEvent.click(rowElement(2));
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});

describe('VirtualizedTable — a detail that takes over its row\'s own cells', () => {
  it('counts the taller line AND the strip when it pushes the rows below down', () => {
    renderTable(editorFor(2));

    // The row being edited is worth its declared line height plus its strip.
    // Counting only the strip — which is what a detail that merely hung
    // beneath its row needed — leaves every row below it 16px too high, and a
    // 16px overlap is exactly the kind of wrong nobody reports precisely.
    expect(topOf(2)).toBe(2 * ROW_HEIGHT);
    expect(topOf(3)).toBe(3 * ROW_HEIGHT + (EDITING_ROW_HEIGHT - ROW_HEIGHT) + DETAIL_HEIGHT);
    expect(topOf(4)).toBe(4 * ROW_HEIGHT + (EDITING_ROW_HEIGHT - ROW_HEIGHT) + DETAIL_HEIGHT);

    // …and the line itself is as tall as it said it was, so the row's cells
    // have room for the controls that are now in them.
    const row = document.getElementById(rowDomId(ROWS[2].id));
    expect(row?.style.height).toBe(`${EDITING_ROW_HEIGHT}px`);
  });

  it('replaces the cell it claims and leaves every other cell reading as it did', () => {
    renderTable(editorFor(2));

    const row = document.getElementById(rowDomId(ROWS[2].id));
    if (!row) throw new Error('the edited row is not rendered');
    const cells = within(row).getAllByRole('gridcell');

    // The claimed cell holds the control, in the same cell — same index, same
    // width, same header — that the value was being read in.
    expect(within(cells[0]).getByTestId('row-editor-field')).toBeInTheDocument();
    expect(within(cells[0]).queryByText(ROWS[2].label)).not.toBeInTheDocument();
    // Everything the detail did not claim is untouched: a cell it says nothing
    // about (undefined, not null) still renders its column's own accessor.
    expect(within(cells[1]).getByText(ROWS[2].note)).toBeInTheDocument();
  });

  it('leaves every OTHER row drawn exactly as it was', () => {
    const { rerender } = renderTable(null);
    const before = document.getElementById(rowDomId(ROWS[5].id))?.outerHTML;

    rerender(
      <VirtualizedTable
        items={ROWS}
        columns={COLUMNS}
        getItemKey={(row: Row) => row.id}
        rowDomId={rowDomId}
        rowHeight={ROW_HEIGHT}
        threshold={50}
        rowDetail={editorFor(2)}
      />
    );

    // Byte for byte, save for the position react-window has moved it to: a
    // detail that could re-draw the rest of the list would be re-drawing
    // eleven thousand rows every time someone clicked one.
    const after = document.getElementById(rowDomId(ROWS[5].id))?.outerHTML;
    const withoutTop = (html: string | undefined): string =>
      (html ?? '').replace(/top: \d+px;/, 'top: …;');
    expect(withoutTop(after)).toBe(withoutTop(before));
  });
});
