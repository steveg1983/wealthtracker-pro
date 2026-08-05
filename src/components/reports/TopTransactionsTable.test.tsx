import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TopTransactionsTable from './TopTransactionsTable';
import type { Category, Transaction } from '../../types';

/**
 * The report's "Top Transactions" table: what it shows (real income and
 * spending only), how it sorts, and the whole row being the way in.
 *
 * No real payees or amounts ever appear in this repo's fixtures.
 */

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number) => `£${Math.abs(Number(n)).toFixed(2)}`,
  }),
}));

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'type-income' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'detail', parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-2' },
  { id: 'type-revaluation', name: 'Revaluation', type: 'both', level: 'type', isSystem: true, isRevaluationCategory: true },
  { id: 'cat-reval', name: 'Market Value Change', type: 'both', level: 'detail', parentId: 'type-revaluation', isRevaluationCategory: true },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -10,
  description: 'synthetic row',
  category: 'cat-groceries',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

const ROWS: Transaction[] = [
  txn({ id: 'spend', date: new Date('2026-07-02'), amount: -120, description: 'synthetic shop' }),
  txn({ id: 'pay', date: new Date('2026-07-20'), amount: 2000, type: 'income', category: 'cat-salary', description: 'synthetic pay' }),
  txn({ id: 'move', date: new Date('2026-07-15'), amount: -9000, type: 'transfer', category: '', description: 'synthetic move' }),
  txn({ id: 'leg', date: new Date('2026-07-16'), amount: -7000, category: 'tofrom-savings', description: 'synthetic leg' }),
  txn({ id: 'reval', date: new Date('2026-07-17'), amount: 8000, type: 'income', category: 'cat-reval', description: 'synthetic valuation' }),
];

const renderTable = (
  rows: Transaction[] = ROWS,
  onOpenTransaction: (id: string) => void = vi.fn()
): void => {
  render(
    <TopTransactionsTable rows={rows} categories={CATEGORIES} onOpenTransaction={onOpenTransaction} />
  );
  // The table starts collapsed, as it does on the report.
  fireEvent.click(screen.getByRole('button', { name: /^Show/ }));
};

/** The desktop table's data rows, in the order rendered. */
const bodyRows = (): HTMLElement[] => {
  const table = screen.getByRole('table');
  const body = table.querySelector('tbody');
  return Array.from(body?.querySelectorAll('tr') ?? []);
};

const descriptions = (): string[] =>
  bodyRows().map(row => (row.querySelectorAll('td')[1]?.textContent ?? '').trim());

const header = (name: string): HTMLElement => {
  const table = screen.getByRole('table');
  return within(table.querySelector('thead') as HTMLElement).getByRole('button', {
    name: new RegExp(`^${name}`),
  });
};

describe('Top Transactions — what it shows', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists real income and spending, never transfers or revaluations', () => {
    renderTable();

    expect(descriptions()).toEqual(['synthetic pay', 'synthetic shop']);
    expect(screen.queryByText('synthetic move')).not.toBeInTheDocument();
    expect(screen.queryByText('synthetic leg')).not.toBeInTheDocument();
    expect(screen.queryByText('synthetic valuation')).not.toBeInTheDocument();
  });

  it('says so plainly when a period holds nothing but transfers and adjustments', () => {
    renderTable([
      txn({ id: 'move', amount: -9000, type: 'transfer', category: '', description: 'synthetic move' }),
      txn({ id: 'reval', amount: 8000, type: 'income', category: 'cat-reval', description: 'synthetic valuation' }),
    ]);

    expect(screen.getAllByText(/No income or spending in this period/).length).toBeGreaterThan(0);
  });
});

describe('Top Transactions — sorting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens on Date, newest first', () => {
    renderTable();

    expect(header('Date')).toHaveTextContent('Date ↓');
    expect(descriptions()).toEqual(['synthetic pay', 'synthetic shop']);
  });

  it('flips the direction when the same heading is clicked again', () => {
    renderTable();

    fireEvent.click(header('Date'));

    expect(header('Date')).toHaveTextContent('Date ↑');
    expect(descriptions()).toEqual(['synthetic shop', 'synthetic pay']);
  });

  it('sorts Amount by SIZE, biggest first, whichever way the money went', () => {
    renderTable([
      txn({ id: 'mid', amount: -500, description: 'synthetic middle' }),
      txn({ id: 'big', amount: 2000, type: 'income', category: 'cat-salary', description: 'synthetic biggest' }),
      txn({ id: 'small', amount: -20, description: 'synthetic smallest' }),
    ]);

    fireEvent.click(header('Amount'));

    expect(header('Amount')).toHaveTextContent('Amount ↓');
    expect(descriptions()).toEqual(['synthetic biggest', 'synthetic middle', 'synthetic smallest']);

    fireEvent.click(header('Amount'));

    expect(descriptions()).toEqual(['synthetic smallest', 'synthetic middle', 'synthetic biggest']);
  });

  it('sorts Description and Category as text, A→Z first', () => {
    renderTable();

    fireEvent.click(header('Description'));
    expect(header('Description')).toHaveTextContent('Description ↑');
    expect(descriptions()).toEqual(['synthetic pay', 'synthetic shop']);

    fireEvent.click(header('Description'));
    expect(descriptions()).toEqual(['synthetic shop', 'synthetic pay']);

    // Categories sort by the name shown, not the id: Groceries before Salary.
    fireEvent.click(header('Category'));
    expect(header('Category')).toHaveTextContent('Category ↑');
    expect(descriptions()).toEqual(['synthetic shop', 'synthetic pay']);
  });

  it('only one heading carries an arrow at a time', () => {
    renderTable();

    fireEvent.click(header('Amount'));

    expect(header('Date')).toHaveTextContent(/^Date$/);
    expect(header('Amount')).toHaveTextContent('Amount ↓');
  });
});

describe('Top Transactions — opening a row', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens the transaction from anywhere in the row, not just the description', () => {
    const onOpenTransaction = vi.fn();
    renderTable(ROWS, onOpenTransaction);

    // The Date cell — the description carries no control of its own any more.
    fireEvent.click(bodyRows()[1]?.querySelectorAll('td')[0] as HTMLElement);

    expect(onOpenTransaction).toHaveBeenCalledWith('spend');
  });

  it('the row itself is the control — reachable and activatable from the keyboard', () => {
    const onOpenTransaction = vi.fn();
    renderTable(ROWS, onOpenTransaction);

    const row = bodyRows()[0] as HTMLElement;
    expect(row).toHaveAttribute('role', 'button');
    expect(row).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onOpenTransaction).toHaveBeenCalledWith('pay');

    fireEvent.keyDown(row, { key: ' ' });
    expect(onOpenTransaction).toHaveBeenCalledTimes(2);
  });

  it('a split line opens its PARENT — the real record', () => {
    const onOpenTransaction = vi.fn();
    render(
      <TopTransactionsTable
        rows={[{ ...txn({ id: 'parent::split::1', amount: -60 }), isSplitLine: true, splitParentId: 'parent' }]}
        categories={CATEGORIES}
        onOpenTransaction={onOpenTransaction}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Show/ }));

    fireEvent.click(bodyRows()[0] as HTMLElement);

    expect(onOpenTransaction).toHaveBeenCalledWith('parent');
  });
});
