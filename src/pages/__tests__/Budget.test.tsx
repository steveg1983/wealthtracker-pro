import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import Budget from '../Budget';
import type { Account, Budget as BudgetType, Category, Transaction, TransactionSplit } from '../../types';

/**
 * What a budget card says it has spent, and what it says is left.
 *
 * The rows are dated inside the CURRENT month, built from the app's own wire
 * shape: Postgres sends `date` as "2026-08-15", which the boundary
 * (utils/dateBoundary) turns into that instant — UTC midnight — before the page
 * ever sees it. Dating them relative to today keeps the test honest on any day
 * of any year without freezing the clock.
 *
 * The app context is the shared test double from src/test/setup.ts; every
 * figure and name here is synthetic (this repo is public).
 */

const now = new Date();
/** The 10th of the current month, exactly as the wire would send it. */
const wireDate = (day: number): Date =>
  new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Synthetic Current', type: 'current', balance: 0, currency: 'GBP', lastUpdated: now, openingBalance: 0 }
];

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'grp-home', name: 'Home', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-household', name: 'Household', type: 'expense', level: 'detail', parentId: 'grp-home' }
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: wireDate(10),
  amount: -10,
  description: 'synthetic row',
  category: 'det-groceries',
  accountId: 'acc-1',
  type: 'expense',
  ...over
});

const budget = (over: Partial<BudgetType> & { id: string; categoryId: string; amount: number }): BudgetType => ({
  period: 'monthly',
  isActive: true,
  spent: 0,
  createdAt: new Date(now.getFullYear(), 0, 1),
  updatedAt: new Date(now.getFullYear(), 0, 1),
  ...over
});

const renderBudget = (): void => {
  render(
    <MemoryRouter initialEntries={['/budget']}>
      <PreferencesProvider>
        <ToastProvider>
          {/* The page raises budget alerts through the notification context,
              exactly as it does inside the real provider stack. */}
          <NotificationProvider>
            <Budget />
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

/** The card for a category, found by its heading. */
const card = (categoryName: string): HTMLElement => {
  const heading = screen.getByRole('heading', { level: 3, name: categoryName });
  const element = heading.closest('div.bg-white');
  if (!element) throw new Error(`No card rendered for ${categoryName}`);
  return element as HTMLElement;
};

describe('Budget page — what a card says has been spent', () => {
  afterEach(() => {
    __resetAppContextValue();
  });

  describe('a plain row and a split line, in one budget', () => {
    beforeEach(() => {
      const splitParent = txn({
        id: 't-split',
        amount: -100,
        isSplit: true,
        category: 'det-household',
        description: 'synthetic split shop'
      });
      const splits: TransactionSplit[] = [
        { id: 'sp-1', transactionId: 't-split', category: 'det-groceries', amount: -30, sortOrder: 0 },
        { id: 'sp-2', transactionId: 't-split', category: 'det-household', amount: -70, sortOrder: 1 }
      ];

      __setAppContextValue({
        accounts: ACCOUNTS,
        categories: CATEGORIES,
        transactions: [txn({ id: 't-1', amount: -40 }), splitParent],
        transactionSplits: splits,
        budgets: [budget({ id: 'bud-groceries', categoryId: 'det-groceries', amount: 200 })]
      });
    });

    it('counts the split line against the budget for the line’s own category', () => {
      renderBudget();

      // £40 plain + the £30 grocery line of the £100 split.
      expect(within(card('Groceries')).getByText('£70.00 of £200.00')).toBeInTheDocument();
      expect(within(card('Groceries')).getByText('£130.00 remaining')).toBeInTheDocument();
      expect(within(card('Groceries')).getByText('35% used')).toBeInTheDocument();
    });

    it('captions the card with the budget’s actual period', () => {
      renderBudget();
      expect(within(card('Groceries')).getByText(/Monthly budget/)).toBeInTheDocument();
    });
  });

  describe('an overspent budget', () => {
    beforeEach(() => {
      __setAppContextValue({
        accounts: ACCOUNTS,
        categories: CATEGORIES,
        transactions: [txn({ id: 't-1', amount: -80 })],
        transactionSplits: [],
        budgets: [budget({ id: 'bud-groceries', categoryId: 'det-groceries', amount: 50 })]
      });
    });

    it('says how far over it is, instead of "£0.00 remaining"', () => {
      renderBudget();

      const groceries = within(card('Groceries'));
      expect(groceries.getByText('over budget by £30.00')).toBeInTheDocument();
      expect(groceries.queryByText(/remaining/)).not.toBeInTheDocument();
      // The percentage tells the truth past 100%…
      expect(groceries.getByText('160% used')).toBeInTheDocument();
      // …while the bar, which has nowhere further to go, stops at full.
      expect(groceries.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });

    it('leaves the page total agreeing with the card', () => {
      renderBudget();

      // Total Remaining is the same overspend, not a floored zero.
      expect(screen.getByText('-£30.00')).toBeInTheDocument();
    });
  });

  describe('a budget on a whole group', () => {
    beforeEach(() => {
      __setAppContextValue({
        accounts: ACCOUNTS,
        categories: CATEGORIES,
        transactions: [
          txn({ id: 't-1', amount: -40, category: 'det-groceries' }),
          txn({ id: 't-2', amount: -25, category: 'grp-food' }),
          txn({ id: 't-3', amount: -60, category: 'det-household' })
        ],
        transactionSplits: [],
        budgets: [budget({ id: 'bud-food', categoryId: 'grp-food', amount: 300 })]
      });
    });

    it('rolls the categories beneath the group up, and nothing outside it', () => {
      renderBudget();

      expect(within(card('Food')).getByText('£65.00 of £300.00')).toBeInTheDocument();
    });
  });
});

/**
 * The two page actions that write: the Active/Inactive toggle and Delete.
 *
 * Both used to be launched and forgotten. A refused write left the row looking
 * exactly as it had, with nothing said — the card kept the truth (the context
 * leaves its state alone when the write throws) while the person who pressed
 * the button was told a budget had changed that had not.
 */
describe('Budget page — a write the server refuses', () => {
  /** Any refusal would do; this is the sentence the live guard uses. */
  const REFUSAL = 'Still connecting to your account — please try again in a moment.';

  const seed = (overrides: { updateBudget?: () => Promise<void>; deleteBudget?: () => Promise<void> }): void => {
    __setAppContextValue({
      accounts: ACCOUNTS,
      categories: CATEGORIES,
      transactions: [txn({ id: 't-1', amount: -40 })],
      transactionSplits: [],
      budgets: [budget({ id: 'bud-groceries', categoryId: 'det-groceries', amount: 200 })],
      ...overrides
    });
  };

  afterEach(() => {
    __resetAppContextValue();
    vi.restoreAllMocks();
  });

  it('says so when the Active toggle is refused, and leaves the card alone', async () => {
    seed({ updateBudget: vi.fn().mockRejectedValue(new Error(REFUSAL)) });
    renderBudget();

    fireEvent.click(within(card('Groceries')).getByRole('button', { name: 'Active' }));

    const shown = await screen.findByText(REFUSAL);
    expect(shown.textContent).toBe(REFUSAL);
    // The toggle still reads what the stored budget actually is.
    expect(within(card('Groceries')).getByRole('button', { name: 'Active' })).toBeInTheDocument();
  });

  it('says so when the delete is refused, and the budget is still there', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    seed({ deleteBudget: vi.fn().mockRejectedValue(new Error(REFUSAL)) });
    renderBudget();

    fireEvent.click(within(card('Groceries')).getByRole('button', { name: 'Delete Budget' }));

    const shown = await screen.findByText(REFUSAL);
    expect(shown.textContent).toBe(REFUSAL);
    expect(card('Groceries')).toBeInTheDocument();
  });

  it('says nothing when the delete goes through', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteBudget = vi.fn().mockResolvedValue(undefined);
    seed({ deleteBudget });
    renderBudget();

    fireEvent.click(within(card('Groceries')).getByRole('button', { name: 'Delete Budget' }));

    await waitFor(() => expect(deleteBudget).toHaveBeenCalledWith('bud-groceries'));
    expect(screen.queryByText(REFUSAL)).not.toBeInTheDocument();
  });

  it('does not delete at all when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteBudget = vi.fn().mockResolvedValue(undefined);
    seed({ deleteBudget });
    renderBudget();

    fireEvent.click(within(card('Groceries')).getByRole('button', { name: 'Delete Budget' }));

    expect(deleteBudget).not.toHaveBeenCalled();
  });
});
