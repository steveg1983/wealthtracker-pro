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
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Category, Transaction } from '../../../types';
import { resolvePeriod, type PeriodKey, type UsePeriodResult } from '../../../hooks/usePeriod';
import type { CardPeriodPin } from '../../../hooks/useCardPeriod';

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

/**
 * A card pinned to a window of its own has to SAY SO.
 *
 * The page-level bar is still the law and still the default (the sibling ruling
 * in ImprovedDashboard.test.tsx). What the owner asked for after living with it
 * is an exception a card can declare: all-time net worth was forcing all-time
 * income-vs-expenses, and a stock and a flow are different lenses. The crime
 * being prevented was never divergence — it was undeclared scope. So the
 * divergence is spelled out, in the card's resting state, where the figures it
 * changes are.
 *
 * `pin` carries no window of its own on purpose: the card's chart, its
 * click-through and its declaration all read the one `picker`, so they cannot
 * come to disagree about which window this card is on.
 */
const following = (): CardPeriodPin => ({
  isPinned: false,
  pinTo: vi.fn(),
  follow: vi.fn(),
  justHeld: false,
  onHeldShown: vi.fn(),
});

const pinned = (over: Partial<CardPeriodPin> = {}): CardPeriodPin => ({
  ...following(),
  isPinned: true,
  ...over,
});

describe('a report card’s period pin', () => {
  it('says nothing at all while the card follows the page', () => {
    render(<NetWorthWidget picker={pickerOn('last-12-months')} pin={following()} />);

    expect(screen.queryByText(/^pinned ·/)).toBeNull();
    expect(screen.queryByRole('button', { name: /follow the page period/ })).toBeNull();
    // The way to pin it is there — quiet, and named for anyone who cannot see
    // which card it sits on.
    expect(screen.getByRole('button', {
      name: 'Net Worth Over Time: period follows the page. Pin this card to its own period',
    })).toBeInTheDocument();
  });

  it('declares the window it was pinned to, and offers the way back', () => {
    render(<NetWorthWidget picker={pickerOn('all')} pin={pinned()} />);

    expect(screen.getByText('pinned · All time')).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Net Worth Over Time: follow the page period',
    })).toBeInTheDocument();
  });

  it('names the card in every window it offers, and marks the one in force', () => {
    render(<ExpenseCategoriesWidget picker={pickerOn('tax-year')} pin={pinned()} />);

    fireEvent.click(screen.getByRole('button', {
      name: 'Expense Categories: pinned to Tax year. Choose a different period for this card',
    }));

    const menu = screen.getByRole('menu', { name: 'Window for Expense Categories' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Tax year' }))
      .toHaveAttribute('aria-checked', 'true');
    // A custom range is a statement about a whole page, and comes with two date
    // fields to make it. A pin is the narrower claim that this lens wants a
    // different STANDARD window.
    expect(within(menu).queryByRole('menuitemradio', { name: 'Custom' })).toBeNull();
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(5);
  });

  it('pins to the window that was picked, and releases on one tap', () => {
    const pinTo = vi.fn();
    const follow = vi.fn();
    render(<IncomeExpenseTrendWidget picker={pickerOn('this-month')} pin={pinned({ pinTo, follow })} />);

    fireEvent.click(screen.getByRole('button', {
      name: 'Income vs Expenses: pinned to This month. Choose a different period for this card',
    }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Window for Income vs Expenses' }))
      .getByRole('menuitemradio', { name: 'All time' }));
    expect(pinTo).toHaveBeenCalledWith('all');

    fireEvent.click(screen.getByRole('button', {
      name: 'Income vs Expenses: follow the page period',
    }));
    expect(follow).toHaveBeenCalledTimes(1);
  });

  it('blinks once when the page clock moved under it, then clears itself', () => {
    const onHeldShown = vi.fn();
    render(<NetWorthWidget picker={pickerOn('all')} pin={pinned({ justHeld: true, onHeldShown })} />);

    const marker = screen.getByText('pinned · All time');
    expect(marker).toHaveClass('animate-pin-ack');

    fireEvent.animationEnd(marker);
    expect(onHeldShown).toHaveBeenCalledTimes(1);
  });

  /** No `pin`, no affordance: exactly the card these were before pins existed. */
  it('renders as it always did when it is given no pin at all', () => {
    render(<NetWorthWidget picker={pickerOn('this-month')} />);

    expect(screen.queryByText(/^pinned ·/)).toBeNull();
    expect(screen.queryByRole('button', { name: /period follows the page/ })).toBeNull();
  });
});
