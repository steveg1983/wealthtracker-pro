/**
 * What a Dashboard report card does when it is clicked.
 *
 * The owner's complaint, in substance: "the dashboard says This month, I click
 * the report, and the report says All time". The card and the report were
 * reading different windows because the click carried nothing at all. These
 * cover the two things that now travel with it — the PERIOD, on the URL, and
 * the way back, in history state — and the third that travels only when a
 * POINT was clicked rather than the header.
 *
 * Every figure, category and account below is invented: this repo is public.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Category, Transaction } from '../../../types';
import { resolvePeriod, type PeriodKey, type UsePeriodResult } from '../../../hooks/usePeriod';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  app: {
    accounts: [] as unknown[],
    transactions: [] as Transaction[],
    transactionSplits: [] as unknown[],
    categories: [] as Category[],
  },
}));

vi.mock('../../../contexts/AppContextSupabase', () => ({ useApp: () => mocks.app }));

vi.mock('../../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Number(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ pathname: '/dashboard', search: '', hash: '', state: null, key: 'test' }),
  };
});

vi.mock('../../../services/customReportService', () => ({
  customReportService: { getCustomReports: () => [] },
}));

const {
  ExpenseCategoriesWidget,
  IncomeExpenseTrendWidget,
  NetWorthWidget,
} = await import('./DashboardReportWidgets');

/** A picker held still: these tests are about the link, not about the hook. */
const pickerOn = (period: PeriodKey): UsePeriodResult => ({
  period,
  setPeriod: vi.fn(),
  customStart: '',
  customEnd: '',
  setCustomStart: vi.fn(),
  setCustomEnd: vi.fn(),
  range: resolvePeriod(period, '', ''),
  inRange: () => true,
  isExplicit: true,
  applyDefaultPeriod: vi.fn(),
  applyArrivalPeriod: vi.fn(),
});

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
];

const spend = (id: string, amount: number): Transaction => ({
  id,
  date: new Date(),
  description: 'Synthetic row',
  amount,
  type: 'expense',
  category: 'det-groceries',
  accountId: 'acc-1',
  cleared: false,
} as unknown as Transaction);

/** The state every card attaches, so the report can offer the way home. */
const FROM_DASHBOARD = { state: { from: { path: '/dashboard', label: 'Back to Dashboard' } } };

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.app.accounts = [];
  mocks.app.transactions = [];
  mocks.app.transactionSplits = [];
  mocks.app.categories = CATEGORIES;
});

describe('a report card’s header', () => {
  it('opens its report over the window the card was read on', () => {
    render(<IncomeExpenseTrendWidget picker={pickerOn('this-month')} />);

    fireEvent.click(screen.getByRole('button', { name: /Income vs Expenses/ }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/reports/income-and-spending-over-time?period=this-month',
      FROM_DASHBOARD
    );
  });

  it('carries whichever window the card is actually on', () => {
    render(<NetWorthWidget picker={pickerOn('tax-year')} />);

    fireEvent.click(screen.getByRole('button', { name: /Net Worth Over Time/ }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/reports/net-worth-over-time?period=tax-year',
      FROM_DASHBOARD
    );
  });
});

describe('a point on a report card', () => {
  it('lands on the report positioned on the category that was clicked', () => {
    mocks.app.transactions = [spend('t1', -40)];
    render(<ExpenseCategoriesWidget picker={pickerOn('this-month')} />);

    // The legend row is the slice's keyboard-reachable twin — an SVG sector is
    // not a control, and both call the same handler.
    fireEvent.click(screen.getByRole('button', { name: /Groceries/ }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/reports/spending-by-category?period=this-month&focus=det-groceries',
      FROM_DASHBOARD
    );
  });

  it('opens the whole report from the header of the same card', () => {
    mocks.app.transactions = [spend('t1', -40)];
    render(<ExpenseCategoriesWidget picker={pickerOn('this-month')} />);

    fireEvent.click(screen.getByRole('button', { name: /Expense Categories/ }));

    // No focus: the header means the report, not one row of it.
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/reports/spending-by-category?period=this-month',
      FROM_DASHBOARD
    );
  });
});
