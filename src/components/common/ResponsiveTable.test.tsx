import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { act } from 'react';
import EmptyState from '../EmptyState';
import FilteredEmptyState from '../FilteredEmptyState';
import { ResponsiveTable, type Column } from './ResponsiveTable';
import { mobileRowHeight, DESKTOP_ROW_HEIGHT, ABSENT_VALUE } from './responsiveTableMetrics';

/**
 * The mobile tree of this component predated the design pass and no ruling had
 * ever reached it, so every table built on it broke four shipped laws on a
 * phone while looking correct on a desktop. These tests are pinned against the
 * MOBILE tree specifically for that reason: the desktop half was already right
 * and was never what failed.
 */

interface Row {
  id: string;
  payee: string;
  category: string;
  amount: string;
}

const rows: Row[] = [
  { id: '1', payee: 'Ferrier & Sons', category: 'Groceries', amount: '-12.40' },
  { id: '2', payee: 'Quenchless Ironmongery', category: '', amount: '-4.05' }
];

const columns: Column<Row>[] = [
  { key: 'payee', label: 'Payee', width: '50%' },
  { key: 'category', label: 'Category', mobileLabel: 'Category', width: '25%' },
  { key: 'amount', label: 'Amount', mobileLabel: 'Amount', width: '25%', numeric: true }
];

/** The phone half of the two trees — the one that had never had a ruling applied. */
function mobileTree(container: HTMLElement): HTMLElement {
  const tree = container.querySelector<HTMLElement>('.sm\\:hidden');
  if (!tree) throw new Error('mobile tree not rendered');
  return tree;
}

function desktopTree(container: HTMLElement): HTMLElement {
  const tree = container.querySelector<HTMLElement>('.hidden.sm\\:block');
  if (!tree) throw new Error('desktop tree not rendered');
  return tree;
}

describe('ResponsiveTable — amounts on the mobile tree (P5)', () => {
  it('gives a numeric field right alignment and tabular figures, on the phone', () => {
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    const amount = within(mobileTree(container)).getAllByText('-12.40')[0];

    // Right-aligned and tabular — "numbers line up or they lie" has to hold on
    // the tree people actually read numbers on.
    expect(amount.className).toContain('tabular-nums');
    expect(amount.className).toContain('text-right');
  });

  it('leaves a non-numeric field alone — the flag is about figures, not every cell', () => {
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    const category = within(mobileTree(container)).getByText('Groceries');
    expect(category.className).not.toContain('tabular-nums');
  });

  it('keeps the caller’s own semantic colour on the figure', () => {
    // income/expense arrives inside render(); the component must not overwrite
    // it while aligning the number.
    const coloured: Column<Row>[] = [
      { key: 'payee', label: 'Payee' },
      {
        key: 'amount',
        label: 'Amount',
        mobileLabel: 'Amount',
        numeric: true,
        render: row => <span className="text-expense">{row.amount}</span>
      }
    ];

    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={coloured}
        getRowKey={row => row.id}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    expect(within(mobileTree(container)).getAllByText('-12.40')[0].className).toContain('text-expense');
  });

  it('right-aligns and tabularises the same column on the desktop tree, from one flag', () => {
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    const cell = within(desktopTree(container)).getAllByText('-12.40')[0];
    expect(cell.className).toContain('tabular-nums');
    expect(cell.className).toContain('text-right');
  });
});

describe('ResponsiveTable — an absent value is marked, never dropped', () => {
  it('renders an em-dash where a field has no value, on the mobile tree', () => {
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    // Row 2's category is '' — it used to VANISH, leaving two rows with
    // different shapes and no way to read the absence.
    expect(within(mobileTree(container)).getByText(ABSENT_VALUE)).toBeInTheDocument();
  });

  it('gives every row the same fields, so two rows are the same shape', () => {
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    const cards = mobileTree(container).children;
    expect(cards).toHaveLength(2);
    // Three mobile columns, therefore three field lines in BOTH rows.
    expect(cards[0].children).toHaveLength(3);
    expect(cards[1].children).toHaveLength(3);
    // ...and the label is still printed beside the dash, so the reader knows
    // which field is the empty one.
    expect(within(cards[1] as HTMLElement).getByText('Category')).toBeInTheDocument();
  });

  it('marks the absence on the desktop tree too', () => {
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    expect(within(desktopTree(container)).getByText(ABSENT_VALUE)).toBeInTheDocument();
  });
});

describe('ResponsiveTable — the retired card treatment is gone from mobile', () => {
  it('rules rows with a hairline instead of wrapping each in a card', () => {
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        onRowClick={vi.fn()}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    const row = mobileTree(container).children[0];
    expect(row.className).toContain('border-b');
    expect(row.className).not.toContain('rounded-lg');
    expect(row.className).not.toContain('shadow');
  });

  it('does not shrink when tapped — these rows navigate, they are not buttons', () => {
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        onRowClick={vi.fn()}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    expect(mobileTree(container).children[0].className).not.toContain('scale-');
  });
});

describe('ResponsiveTable — true-empty and filtered-empty are distinguishable', () => {
  /**
   * THE BATCH 7 GATE. The component could not express this distinction at all
   * before — one `emptyMessage` string served both — and "my transactions are
   * gone" is the most alarming thing a finance app can say by accident.
   */
  it('the true-empty state names the absence and offers a remedy, and never a hidden count', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={
          <EmptyState
            title="No transactions in this account yet"
            description="Its balance stays at £0.00 until something lands here."
            action={{ label: 'Add transaction', onClick: vi.fn() }}
          />
        }
      />
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'No transactions in this account yet' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeInTheDocument();
    // "0 are hidden by …" would be an absurdity, and a Clear filters button
    // that clears nothing is a lie.
    expect(screen.queryByText(/are hidden by/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('the filtered-empty state names the hidden count and the filters responsible', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={
          <FilteredEmptyState
            hiddenCount={1284}
            filters={['Category: Travel', 'This month']}
            onClear={vi.fn()}
          />
        }
      />
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'No transactions match these filters' })
    ).toBeInTheDocument();
    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText(/are hidden by/)).toBeInTheDocument();
    expect(screen.getByText('Category: Travel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    // ...and it is NOT the other one.
    expect(
      screen.queryByRole('heading', { name: 'No transactions in this account yet' })
    ).not.toBeInTheDocument();
  });
});

describe('ResponsiveTable — the loading placeholder', () => {
  beforeEach(() => {
    // The global setup has already mocked the clock, so the timers have to be
    // handed back before they can be taken again — the house idiom.
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('shows nothing at all under 200ms', () => {
    const { container } = render(
      <ResponsiveTable
        data={[]}
        columns={columns}
        getRowKey={row => row.id}
        isLoading
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
    // ...and certainly not the empty state, which would be a lie about data
    // that is still on its way.
    expect(screen.queryByRole('heading', { name: 'No rows yet' })).toBeNull();
  });

  it('stands at exactly the real row height, so nothing shifts when rows arrive', () => {
    const { container } = render(
      <ResponsiveTable
        data={[]}
        columns={columns}
        getRowKey={row => row.id}
        isLoading
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    act(() => {
      vi.advanceTimersByTime(250);
    });

    const skeletonRow = desktopTree(container).querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(skeletonRow).not.toBeNull();
    expect(skeletonRow?.style.height).toBe(`${DESKTOP_ROW_HEIGHT}px`);
  });

  it('stands at exactly the real MOBILE row height, computed by the same function', () => {
    const { container } = render(
      <ResponsiveTable
        data={[]}
        columns={columns}
        getRowKey={row => row.id}
        isLoading
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    act(() => {
      vi.advanceTimersByTime(250);
    });

    const skeletonRow = mobileTree(container).querySelector<HTMLElement>('[aria-hidden="true"]');
    // Three mobile columns, so the placeholder is as tall as a three-field row.
    expect(skeletonRow?.style.height).toBe(`${mobileRowHeight(3)}px`);
  });

  it('the real mobile row declares the same height the placeholder stood at', () => {
    // The pin that stops the two drifting: one function, both consumers. A
    // placeholder of the wrong height is a layout shift with extra steps.
    const { container } = render(
      <ResponsiveTable
        data={rows}
        columns={columns}
        getRowKey={row => row.id}
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    const realRow = mobileTree(container).children[0] as HTMLElement;
    expect(realRow.style.minHeight).toBe(`${mobileRowHeight(3)}px`);
  });

  it('never pulses', () => {
    const { container } = render(
      <ResponsiveTable
        data={[]}
        columns={columns}
        getRowKey={row => row.id}
        isLoading
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(container.querySelector('.animate-pulse')).toBeNull();
    expect(container.querySelector('.animate-fade-in')).not.toBeNull();
  });

  it('caps the placeholder at three rows', () => {
    const { container } = render(
      <ResponsiveTable
        data={[]}
        columns={columns}
        getRowKey={row => row.id}
        isLoading
        emptyContent={<EmptyState title="No rows yet" />}
      />
    );

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(desktopTree(container).querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});

describe('mobileRowHeight', () => {
  it('is the padding, one line per field, the gaps between them, and the rule', () => {
    // 24 padding + 20 line + 1 rule = 45
    expect(mobileRowHeight(1)).toBe(45);
    // + 4 gap + 20 line = 69
    expect(mobileRowHeight(2)).toBe(69);
    // MEASURED at 375px in the running app: 93.
    expect(mobileRowHeight(3)).toBe(93);
  });

  it('is the padding and the rule when a row carries no fields', () => {
    expect(mobileRowHeight(0)).toBe(25);
  });

  it('counts the hairline the row is ruled with', () => {
    // The 1px that was missing first time round. Everything is border-box, so
    // the placeholder draws its rule INSIDE its declared height while a real
    // row adds it outside the padding — three rows of the smaller figure and
    // the table jumps 3px when the data lands.
    expect(DESKTOP_ROW_HEIGHT).toBe(37);
  });
});
