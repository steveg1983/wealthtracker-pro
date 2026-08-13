import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../../contexts/PreferencesContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { usePeriod } from '../../../hooks/usePeriod';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import PeriodComparisonReport from '../PeriodComparisonReport';
import { SEMANTIC_SERIES } from '../../../components/charts/chartColors';
import type { Account, Category, Transaction } from '../../../types';

/**
 * "Biggest movers" says which way the money went by COLOUR, so the colours
 * are asserted from the rendered chart rather than trusted.
 *
 * Recharts sizes itself from the DOM, and jsdom lays nothing out — so
 * ResponsiveContainer (and only ResponsiveContainer) is replaced with a fixed
 * size. That is a missing browser API being stood in for, not the chart being
 * faked: every bar below is drawn by the real recharts.
 */
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) =>
      React.cloneElement(children, { width: 800, height: 400 }),
  };
});

// Read from the token module, not re-typed: a test that hard-codes the colour
// it expects passes just as happily when the chart and the token sheet have
// drifted apart, which is the failure this pair of tokens exists to stop.
const INCOME_FILL = SEMANTIC_SERIES.income;
const EXPENSE_FILL = SEMANTIC_SERIES.expense;
const COMPARISON_FILL = '#94A3B8';

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
  date: new Date(2026, 2, 10),
  amount: -10,
  description: 'synthetic row',
  category: 'cat-groceries',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

/** One income category and one expense category, in both windows. */
const TRANSACTIONS: Transaction[] = [
  txn({ id: 'i1', amount: 1000, type: 'income', category: 'grp-salary', description: 'synthetic pay' }),
  txn({ id: 'e1', amount: -100 }),
  txn({ id: 'i2', date: new Date(2026, 1, 10), amount: 900, type: 'income', category: 'grp-salary', description: 'synthetic pay before' }),
  txn({ id: 'e2', date: new Date(2026, 1, 10), amount: -60 }),
];

const PERIOD_KEY = 'test.reportsPeriod';

const Harness = (): React.JSX.Element => {
  const picker = usePeriod(PERIOD_KEY, 'this-month');
  return <PeriodComparisonReport picker={picker} />;
};

const fillsOf = (container: HTMLElement, seriesIndex: number): string[] =>
  [...container.querySelectorAll('.recharts-bar')[seriesIndex].querySelectorAll('.recharts-bar-rectangle path')]
    .map(path => path.getAttribute('fill') ?? '');

describe('PeriodComparisonReport — Biggest movers, in colour', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(PERIOD_KEY, 'custom');
    localStorage.setItem(`${PERIOD_KEY}Explicit`, 'true');
    localStorage.setItem(`${PERIOD_KEY}CustomStart`, '2026-03-01');
    localStorage.setItem(`${PERIOD_KEY}CustomEnd`, '2026-03-31');
    __setAppContextValue({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: TRANSACTIONS });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('draws this period green for income and red for spending, the comparison grey', () => {
    const { container } = render(
      <MemoryRouter>
        <PreferencesProvider>
          <ToastProvider>
            <Harness />
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

    // Salary moved £100, groceries £40 — so the income bar is first.
    expect(fillsOf(container, 0)).toEqual([INCOME_FILL, EXPENSE_FILL]);
    expect(fillsOf(container, 1)).toEqual([COMPARISON_FILL, COMPARISON_FILL]);
  });

  it('names both colours in the legend, and the comparison window it is against', () => {
    render(
      <MemoryRouter>
        <PreferencesProvider>
          <ToastProvider>
            <Harness />
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('This period — income')).toBeInTheDocument();
    expect(screen.getByText('This period — expenses')).toBeInTheDocument();
    // The comparison entry says which window it is, not "previous".
    expect(screen.getAllByText('Previous period').length).toBeGreaterThan(0);
  });
});
