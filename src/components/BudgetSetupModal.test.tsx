/**
 * Setting budgets against real spending — through the UI.
 *
 * What is pinned here is the owner's four rulings made visible: one rhythm
 * for the screen with both figures always shown, budgets at the leaf, the
 * window as his choice (whole months by default), and a write that only ever
 * saves a figure somebody typed.
 *
 * Every name and amount is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import BudgetSetupModal from './BudgetSetupModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Budget, Category, Transaction } from '../types';

const toast = vi.hoisted(() => ({
  showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(),
  showInfo: vi.fn(), showToast: vi.fn(), dismissToast: vi.fn(),
}));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number) => `£${Number(n).toFixed(2)}`,
    displayCurrency: 'GBP', getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
  }),
}));

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-shop', name: 'Food Shopping', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-dining', name: 'Dining Out', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-quiet', name: 'Never Used', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

/**
 * £1,200 of shopping across the last full year, in twelve tidy £100 months.
 *
 * Dated RELATIVE to whatever clock the suite runs under — the environment
 * fixes its own "now" (measured: January 2025), so hard-coded dates fall
 * outside the window and every figure reads zero. The 10th of each of the
 * twelve complete months before this one is inside both windows by
 * construction.
 */
const lastFullMonth = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0);
})();
const monthlySpend = (
  idPrefix: string,
  category: string,
  amount: number
): Transaction[] => Array.from({ length: 12 }, (_, i) => ({
  id: `${idPrefix}-${i}`,
  accountId: 'acc-1',
  description: 'Synthetic row',
  amount: -amount,
  type: 'expense' as const,
  category,
  date: new Date(lastFullMonth.getFullYear(), lastFullMonth.getMonth() - i, 10),
}));

/** Two categories with real spending, so an ORDER is observable at all. */
const TRANSACTIONS: Transaction[] = [
  ...monthlySpend('shop', 'det-shop', 100),      // £1,200 a year
  ...monthlySpend('dine', 'det-dining', 50),     // £600 a year
];

const addBudget = vi.fn(async () => {});
const updateBudget = vi.fn(async () => {});

const renderModal = (budgets: Budget[] = []): void => {
  __setAppContextValue({
    transactions: TRANSACTIONS, transactionSplits: [], categories: CATEGORIES,
    budgets, addBudget, updateBudget,
  });
  render(<BudgetSetupModal isOpen onClose={vi.fn()} />);
};

const rowFor = (name: string): HTMLElement =>
  screen.getByText(name).closest('tr') as HTMLElement;

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); __resetAppContextValue(); });

describe('BudgetSetupModal — the evidence', () => {
  it('shows each category\'s year and its month, side by side', () => {
    renderModal();
    const row = rowFor('Food Shopping');
    expect(within(row).getByText('£1200.00')).toBeInTheDocument(); // the year
    expect(within(row).getByText('£100.00')).toBeInTheDocument();  // per month
  });

  it('defaults to the last 12 FULL months — a part-month is not evidence', () => {
    renderModal();
    expect(screen.getByLabelText('Which twelve months to measure')).toHaveValue('full-months');
    expect(screen.getAllByText(/the last 12 full months/i).length).toBeGreaterThan(0);
  });

  it('offers the rolling year as the owner\'s alternative', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Which twelve months to measure'), {
      target: { value: 'to-yesterday' },
    });
    expect(screen.getAllByText(/the 12 months to yesterday/i).length).toBeGreaterThan(0);
  });

  it('tucks categories with no spending away rather than padding the list with zeros', () => {
    renderModal();
    expect(screen.queryByText('Never Used')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /have not spent in/ }));
    expect(screen.getByText('Never Used')).toBeInTheDocument();
  });
});

describe('BudgetSetupModal — typing one figure and seeing the other', () => {
  it('a monthly figure states its year', () => {
    renderModal();
    const row = rowFor('Food Shopping');
    fireEvent.change(within(row).getByLabelText('Monthly budget for Food Shopping'), {
      target: { value: '90' },
    });
    expect(within(row).getByText('£1080.00 a year')).toBeInTheDocument();
  });

  it('switching rhythm switches which figure is typed, and the twin follows', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Annually' }));
    const row = rowFor('Food Shopping');
    fireEvent.change(within(row).getByLabelText('Yearly budget for Food Shopping'), {
      target: { value: '1200' },
    });
    expect(within(row).getByText('£100.00 a month')).toBeInTheDocument();
  });

  it('"use my actual" fills the box rather than saving behind you', async () => {
    renderModal();
    const row = rowFor('Food Shopping');
    fireEvent.click(within(row).getByRole('button', { name: 'use my actual' }));
    expect(within(row).getByLabelText('Monthly budget for Food Shopping')).toHaveValue(100);
    expect(addBudget).not.toHaveBeenCalled();
  });
});

describe('BudgetSetupModal — the order the rows come in', () => {
  /** The category names on screen, in the order the list presents them. */
  const namesInOrder = (): string[] =>
    screen.getAllByRole('row')
      .map(row => row.textContent ?? '')
      .flatMap(text =>
        ['Food Shopping', 'Dining Out'].filter(name => text.startsWith(name)));

  it('leads with the biggest spend, because that is where the decisions are', () => {
    renderModal();
    expect(namesInOrder()).toEqual(['Food Shopping', 'Dining Out']);
  });

  it('reverses on request — least spent first', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Order'), { target: { value: 'lowest' } });
    expect(namesInOrder()).toEqual(['Dining Out', 'Food Shopping']);
  });

  it('sorts A–Z on request', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Order'), { target: { value: 'az' } });
    expect(namesInOrder()).toEqual(['Dining Out', 'Food Shopping']);
  });

  it("offers the owner's four orders and nothing invented", () => {
    renderModal();
    const select = screen.getByLabelText('Order');
    for (const label of ['Most spent first', 'Least spent first', 'By category group', 'A–Z']) {
      expect(within(select).getByRole('option', { name: label })).toBeInTheDocument();
    }
  });
});

describe('BudgetSetupModal — what it writes', () => {
  it('saves only the rows somebody typed, at the leaf, in the chosen rhythm', async () => {
    renderModal();
    const row = rowFor('Food Shopping');
    fireEvent.change(within(row).getByLabelText('Monthly budget for Food Shopping'), {
      target: { value: '90' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set 1 budget' }));

    await waitFor(() => expect(addBudget).toHaveBeenCalledTimes(1));
    expect(addBudget).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 'det-shop', amount: 90, period: 'monthly', isActive: true,
    }));
    // Dining Out was left empty: an empty box is "no budget", not "zero".
    expect(addBudget).not.toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'det-dining' }));
  });

  it('has nothing to save until something is typed', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Nothing to save yet' })).toBeDisabled();
  });

  it('updates a category that already has a budget instead of adding a second', async () => {
    const existing: Budget = {
      id: 'bud-1', categoryId: 'det-shop', amount: 120, period: 'monthly',
      isActive: true, spent: 0, createdAt: new Date(), updatedAt: new Date(),
    };
    renderModal([existing]);
    const row = rowFor('Food Shopping');
    // It starts at what is already stored…
    expect(within(row).getByLabelText('Monthly budget for Food Shopping')).toHaveValue(120);
    fireEvent.change(within(row).getByLabelText('Monthly budget for Food Shopping'), {
      target: { value: '95' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set 1 budget' }));

    await waitFor(() => expect(updateBudget).toHaveBeenCalledTimes(1));
    expect(updateBudget).toHaveBeenCalledWith('bud-1', { amount: 95, period: 'monthly' });
    expect(addBudget).not.toHaveBeenCalled();
  });

  it('re-typing the figure already stored is not a write', () => {
    const existing: Budget = {
      id: 'bud-1', categoryId: 'det-shop', amount: 120, period: 'monthly',
      isActive: true, spent: 0, createdAt: new Date(), updatedAt: new Date(),
    };
    renderModal([existing]);
    const row = rowFor('Food Shopping');
    fireEvent.change(within(row).getByLabelText('Monthly budget for Food Shopping'), {
      target: { value: '120' },
    });
    expect(screen.getByRole('button', { name: 'Nothing to save yet' })).toBeDisabled();
  });
});
