/**
 * Settings → Categories: the budget a category carries.
 *
 * The owner's ruling (31 Aug 2026): a budget is a PROPERTY of a category, not
 * a separate object sharing its name. So there are two lenses over one thing —
 * this page says WHAT IS SET, the Budget page says how it is going — and both
 * read the same rows, keyed by category id, with nothing added to the schema.
 *
 * What is pinned here: the figure appears beside the category that owns it, in
 * the period it is STORED in, an unbudgeted category shows nothing at all
 * (rather than a "£0.00" that would claim a budget of nothing), and the wizard
 * is reachable from this page as well as from Budget.
 *
 * Every name and amount is invented: this repo is public.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoriesSettings from './Categories';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Budget, Category, Transaction } from '../../types';

const toast = vi.hoisted(() => ({
  showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(),
  showInfo: vi.fn(), showToast: vi.fn(), dismissToast: vi.fn(),
}));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number | { toNumber: () => number }) =>
      `£${(typeof amount === 'number' ? amount : amount.toNumber()).toFixed(2)}`,
    displayCurrency: 'GBP', getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
  }),
}));

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-shop', name: 'Food Shopping', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: 'cat-dining', name: 'Dining Out', type: 'expense', level: 'detail', parentId: 'sub-food' },
];

const TRANSACTIONS: Transaction[] = [
  {
    id: 't1', date: new Date(), amount: -40, description: 'Synthetic row',
    category: 'cat-shop', accountId: 'acc-1', type: 'expense',
  },
];

const budgetOf = (over: Partial<Budget> & { id: string; categoryId: string }): Budget => ({
  amount: 120, period: 'monthly', isActive: true, spent: 0,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

const setup = (budgets: Budget[] = []): void => {
  __setAppContextValue({
    categories: CATEGORIES,
    transactions: TRANSACTIONS,
    transactionSplits: [],
    budgets,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
  });
  render(<MemoryRouter><CategoriesSettings /></MemoryRouter>);
};

/** The detail rows live under a fold, as they always have on this page. */
const expandFood = (): void => fireEvent.click(screen.getByLabelText('Expand Food'));

const rowFor = (name: string): HTMLElement => {
  const label = screen.getByText(name);
  const row = label.closest('div.flex.items-center.justify-between');
  if (!row) throw new Error(`no row for ${name}`);
  return row as HTMLElement;
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); __resetAppContextValue(); });

describe('Categories — the budget a category carries', () => {
  it('shows a monthly budget beside the category that owns it', () => {
    setup([budgetOf({ id: 'b-1', categoryId: 'cat-shop', amount: 120 })]);
    expandFood();
    const row = rowFor('Food Shopping');
    expect(within(row).getByText('£120.00')).toBeInTheDocument();
    expect(within(row).getByText('/mo')).toBeInTheDocument();
  });

  it('shows a yearly budget as a year — the period it is stored in, not normalised', () => {
    setup([budgetOf({ id: 'b-1', categoryId: 'cat-shop', amount: 1500, period: 'yearly' })]);
    expandFood();
    const row = rowFor('Food Shopping');
    expect(within(row).getByText('£1500.00')).toBeInTheDocument();
    expect(within(row).getByText('/yr')).toBeInTheDocument();
  });

  it('leaves an unbudgeted category EMPTY rather than claiming a budget of nothing', () => {
    setup([budgetOf({ id: 'b-1', categoryId: 'cat-shop', amount: 120 })]);
    expandFood();
    const row = rowFor('Dining Out');
    expect(within(row).queryByText(/£/)).not.toBeInTheDocument();
    expect(within(row).queryByText('/mo')).not.toBeInTheDocument();
  });

  it('shows a group budget on the group, where it is actually stored', () => {
    setup([budgetOf({ id: 'b-grp', categoryId: 'sub-food', amount: 400 })]);
    const row = rowFor('Food');
    expect(within(row).getByText('£400.00')).toBeInTheDocument();
  });

  it('ignores a deactivated budget — it is not set any more', () => {
    setup([budgetOf({ id: 'b-off', categoryId: 'cat-shop', isActive: false })]);
    expandFood();
    expect(within(rowFor('Food Shopping')).queryByText(/£/)).not.toBeInTheDocument();
  });

  it('says what a weekly budget is, in weeks', () => {
    setup([budgetOf({ id: 'b-wk', categoryId: 'cat-shop', amount: 30, period: 'weekly' })]);
    expandFood();
    const row = rowFor('Food Shopping');
    expect(within(row).getByText('£30.00')).toBeInTheDocument();
    expect(within(row).getByText('/wk')).toBeInTheDocument();
  });
});

describe('Categories — the way in to setting them', () => {
  it('offers the wizard from this page, not only from Budget', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Set up budgets' })).toBeInTheDocument();
  });

  it('opens it on a press', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Set up budgets' }));
    expect(await screen.findByText('Do you think in months or years?')).toBeInTheDocument();
  });
});
