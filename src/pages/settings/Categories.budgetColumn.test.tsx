/**
 * Settings → Categories: NO budget figures on this page.
 *
 * The owner's ruling (1 Sep 2026, reversing 31 Aug's "other lens"): this page
 * is for looking into categories and the transactions filed under them, and a
 * budget figure beside each row made it read as a budgeting page. A budget is
 * still a property of the category — merging and deleting still move and
 * count them (Categories.merge.test.tsx pins that) — but the AMOUNTS live on
 * the Budget page only. What this page keeps is the way in to setting them:
 * the wizard button.
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

describe('Categories — a budgeted category shows no figure here', () => {
  it('shows nothing beside a detail category that HAS a budget', () => {
    setup([budgetOf({ id: 'b-1', categoryId: 'cat-shop', amount: 120 })]);
    expandFood();
    const row = rowFor('Food Shopping');
    expect(within(row).queryByText(/£/)).not.toBeInTheDocument();
    expect(within(row).queryByText('/mo')).not.toBeInTheDocument();
  });

  it('shows nothing beside a group that has a budget of its own', () => {
    setup([budgetOf({ id: 'b-grp', categoryId: 'sub-food', amount: 400 })]);
    const row = rowFor('Food');
    expect(within(row).queryByText(/£/)).not.toBeInTheDocument();
  });

  it('shows nothing whatever the stored period', () => {
    setup([
      budgetOf({ id: 'b-yr', categoryId: 'cat-shop', amount: 1500, period: 'yearly' }),
      budgetOf({ id: 'b-wk', categoryId: 'cat-dining', amount: 30, period: 'weekly' }),
    ]);
    expandFood();
    expect(within(rowFor('Food Shopping')).queryByText(/\/yr|£/)).not.toBeInTheDocument();
    expect(within(rowFor('Dining Out')).queryByText(/\/wk|£/)).not.toBeInTheDocument();
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
