import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { usePeriod } from '../../../hooks/usePeriod';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import IncomeSpendingOverTimeReport from '../IncomeSpendingOverTimeReport';
import type { Account, Category, Transaction } from '../../../types';

/**
 * The Cumulative toggle end to end: the SAME report re-read as running totals,
 * and back again.
 *
 * The app context is the shared test double from src/test/setup.ts, given a
 * synthetic three-month history here (no real payees, amounts or account names
 * ever appear in this repo's fixtures) so the figures can be asserted exactly.
 *
 * Month LABELS are deliberately never asserted: the series keys months in UTC,
 * so the words in the column would move with the runner's timezone. The
 * figures do not.
 */

const CUMULATIVE_KEY = 'reports.incomeSpendingOverTime.cumulative.v1';

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Synthetic Current', type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date(2026, 2, 31), openingBalance: 0 },
];

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'grp-food', name: 'Food Related Costs', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date(2026, 0, 5),
  amount: -10,
  description: 'synthetic row',
  category: 'cat-groceries',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

/** Three months, so there is something to accumulate. */
const TRANSACTIONS: Transaction[] = [
  txn({ id: 'i1', date: new Date(2026, 0, 28), amount: 2000, type: 'income', category: 'grp-salary', description: 'synthetic pay one' }),
  txn({ id: 'i2', date: new Date(2026, 1, 28), amount: 2000, type: 'income', category: 'grp-salary', description: 'synthetic pay two' }),
  txn({ id: 'i3', date: new Date(2026, 2, 28), amount: 2000, type: 'income', category: 'grp-salary', description: 'synthetic pay three' }),
  txn({ id: 'e1', date: new Date(2026, 0, 5), amount: -40.25 }),
  txn({ id: 'e2', date: new Date(2026, 1, 5), amount: -60.5 }),
  txn({ id: 'e3', date: new Date(2026, 2, 5), amount: -10.25 }),
];

const Harness = (): React.JSX.Element => {
  // All time, so every month of the fixture is in the window.
  const picker = usePeriod('test.reportsPeriod', 'all');
  return <IncomeSpendingOverTimeReport picker={picker} />;
};

const renderReport = (): void => {
  render(
    /* The review band and the drill-in navigate and toast, exactly as they do
       inside the real provider stack. */
    <MemoryRouter>
      <PreferencesProvider>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/** Body and footer rows both lead with a row header, so the tds line up. */
const figuresOf = (row: HTMLElement): string[] =>
  within(row).getAllByRole('cell').map(cell => cell.textContent?.trim() ?? '');

const tableRows = (): HTMLElement[] => within(screen.getByRole('table')).getAllByRole('row');

/** The month rows, without the heading row or the period Total footer. */
const monthRows = (): HTMLElement[] => tableRows().slice(1, -1);

const totalRow = (): HTMLElement => tableRows()[tableRows().length - 1];

const cumulativeBox = (): HTMLElement => screen.getByRole('checkbox', { name: 'Cumulative' });

describe('IncomeSpendingOverTimeReport — the Cumulative toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    __setAppContextValue({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: TRANSACTIONS });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('starts month by month, with the control unticked', () => {
    renderReport();

    expect(cumulativeBox()).not.toBeChecked();
    expect(screen.getByRole('heading', { name: 'Income against spending' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Income' })).toBeInTheDocument();
    expect(screen.getByText('Every month on its own.')).toBeInTheDocument();

    expect(monthRows().map(figuresOf)).toEqual([
      ['£2,000.00', '£40.25', '£1,959.75'],
      ['£2,000.00', '£60.50', '£1,939.50'],
      ['£2,000.00', '£10.25', '£1,989.75'],
    ]);
    expect(figuresOf(totalRow())).toEqual(['£6,000.00', '£111.00', '£5,889.00']);
  });

  it('re-renders the same report as running totals, and back again', () => {
    renderReport();

    fireEvent.click(cumulativeBox());

    expect(monthRows().map(figuresOf)).toEqual([
      // The first month has nothing before it...
      ['£2,000.00', '£40.25', '£1,959.75'],
      ['£4,000.00', '£100.75', '£3,899.25'],
      // ...and the last IS the period total.
      ['£6,000.00', '£111.00', '£5,889.00'],
    ]);
    // The period's own totals are the same figures either way.
    expect(figuresOf(totalRow())).toEqual(['£6,000.00', '£111.00', '£5,889.00']);

    fireEvent.click(cumulativeBox());

    expect(monthRows().map(figuresOf)).toEqual([
      ['£2,000.00', '£40.25', '£1,959.75'],
      ['£2,000.00', '£60.50', '£1,939.50'],
      ['£2,000.00', '£10.25', '£1,989.75'],
    ]);
  });

  it('says it is showing running totals rather than months', () => {
    renderReport();

    fireEvent.click(cumulativeBox());

    expect(screen.getByRole('heading', { name: 'Income against spending, running totals' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Income to date' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Expenses to date' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Left over to date' })).toBeInTheDocument();
    expect(screen.getByText('Running totals: every row is the period up to the end of that month.')).toBeInTheDocument();
    // Every figure says what it covers before it is clicked.
    expect(screen.getAllByTitle(/^Income to .+ — view these transactions$/)).toHaveLength(3);
  });

  it('a running total drills into every month behind it, not just its own', () => {
    renderReport();

    fireEvent.click(cumulativeBox());
    const lastMonth = monthRows()[2];
    fireEvent.click(within(lastMonth).getByTitle(/^Income to .+ — view these transactions$/));

    expect(screen.getByText(/^Income — to /)).toBeInTheDocument();
    // All three months of pay, adding up to the £6,000.00 that was clicked.
    expect(screen.getByText('synthetic pay one')).toBeInTheDocument();
    expect(screen.getByText('synthetic pay two')).toBeInTheDocument();
    expect(screen.getByText('synthetic pay three')).toBeInTheDocument();
  });

  it('a month-by-month figure still drills into that month alone', () => {
    renderReport();

    const lastMonth = monthRows()[2];
    fireEvent.click(within(lastMonth).getByTitle(/^Income, .+ — view these transactions$/));

    expect(screen.getByText('synthetic pay three')).toBeInTheDocument();
    expect(screen.queryByText('synthetic pay one')).not.toBeInTheDocument();
  });

  it('remembers the choice for the next visit', () => {
    renderReport();

    fireEvent.click(cumulativeBox());
    expect(localStorage.getItem(CUMULATIVE_KEY)).toBe('1');

    fireEvent.click(cumulativeBox());
    expect(localStorage.getItem(CUMULATIVE_KEY)).toBe('0');
  });

  it('opens ticked when it was left ticked', () => {
    localStorage.setItem(CUMULATIVE_KEY, '1');
    renderReport();

    expect(cumulativeBox()).toBeChecked();
    expect(screen.getByRole('columnheader', { name: 'Income to date' })).toBeInTheDocument();
  });
});
