import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { usePeriod } from '../../hooks/usePeriod';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import Reports from '../Reports';
import type { Account, Category, Transaction } from '../../types';

/**
 * "Monthly income and expenses" read as running totals: the Cumulative toggle
 * over the category × month matrix.
 *
 * The app context is the shared test double from src/test/setup.ts, given a
 * synthetic three-month history here (no real payees, amounts or account names
 * ever appear in this repo's fixtures).
 *
 * Only the FIRST THREE columns are asserted: an all-time window runs to today,
 * so the number of columns after March moves with the calendar, and a test
 * that counts them would start failing on its own.
 */

const CUMULATIVE_KEY = 'reports.monthlyIncomeExpenses.cumulative.v1';

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

const TRANSACTIONS: Transaction[] = [
  txn({ id: 'i1', date: new Date(2026, 0, 28), amount: 2000, type: 'income', category: 'grp-salary', description: 'synthetic pay one' }),
  txn({ id: 'i2', date: new Date(2026, 1, 28), amount: 2000, type: 'income', category: 'grp-salary', description: 'synthetic pay two' }),
  txn({ id: 'i3', date: new Date(2026, 2, 28), amount: 2000, type: 'income', category: 'grp-salary', description: 'synthetic pay three' }),
  txn({ id: 'e1', date: new Date(2026, 0, 5), amount: -40.25 }),
  txn({ id: 'e2', date: new Date(2026, 1, 5), amount: -60.5 }),
  txn({ id: 'e3', date: new Date(2026, 2, 5), amount: -10.25 }),
];

const Harness = (): React.JSX.Element => {
  const picker = usePeriod('test.reportsPeriod', 'all');
  return <Reports picker={picker} />;
};

const renderReport = (): void => {
  render(
    <MemoryRouter>
      <PreferencesProvider>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const cumulativeBox = (): HTMLElement => screen.getByRole('checkbox', { name: 'Cumulative' });

/** Jan, Feb, March of the fixture, from a footer row of the matrix. */
const firstThreeMonths = (rowName: string): string[] => {
  const row = screen.getByRole('rowheader', { name: rowName }).closest('tr');
  return within(row as HTMLElement)
    .getAllByRole('cell')
    .slice(0, 3)
    .map(cell => cell.textContent?.trim() ?? '');
};

describe('Monthly income and expenses — the Cumulative toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    __setAppContextValue({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: TRANSACTIONS });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('starts with each month on its own', () => {
    renderReport();

    expect(cumulativeBox()).not.toBeChecked();
    expect(firstThreeMonths('Total Income')).toEqual(['£2,000.00', '£2,000.00', '£2,000.00']);
    expect(firstThreeMonths('Total Expenses')).toEqual(['£40.25', '£60.50', '£10.25']);
    expect(firstThreeMonths('Income less Expenses')).toEqual(['£1,959.75', '£1,939.50', '£1,989.75']);
  });

  it('re-renders the same matrix as running totals, and back again', () => {
    renderReport();

    fireEvent.click(cumulativeBox());

    expect(firstThreeMonths('Total Income')).toEqual(['£2,000.00', '£4,000.00', '£6,000.00']);
    expect(firstThreeMonths('Total Expenses')).toEqual(['£40.25', '£100.75', '£111.00']);
    expect(firstThreeMonths('Income less Expenses')).toEqual(['£1,959.75', '£3,899.25', '£5,889.00']);
    // A category row accumulates with the rest of them.
    expect(firstThreeMonths('Groceries')).toEqual(['£40.25', '£100.75', '£111.00']);

    fireEvent.click(cumulativeBox());

    expect(firstThreeMonths('Total Expenses')).toEqual(['£40.25', '£60.50', '£10.25']);
  });

  it('a cumulative cell drills into every month behind it, not just its own', () => {
    renderReport();

    fireEvent.click(cumulativeBox());
    // Third column: the period to the end of March.
    fireEvent.click(screen.getAllByTitle(/^Total Income · to .+ — view these transactions$/)[2]);

    const drill = within(screen.getByRole('dialog'));
    expect(drill.getByText('synthetic pay one')).toBeInTheDocument();
    expect(drill.getByText('synthetic pay two')).toBeInTheDocument();
    expect(drill.getByText('synthetic pay three')).toBeInTheDocument();
  });

  it('a month-by-month cell still drills into that month alone', () => {
    renderReport();

    fireEvent.click(screen.getAllByTitle(/^Total Income · .+ — view these transactions$/)[2]);

    const drill = within(screen.getByRole('dialog'));
    expect(drill.getByText('synthetic pay three')).toBeInTheDocument();
    expect(drill.queryByText('synthetic pay one')).not.toBeInTheDocument();
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
    expect(firstThreeMonths('Total Expenses')).toEqual(['£40.25', '£100.75', '£111.00']);
  });
});
