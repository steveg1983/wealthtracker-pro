/**
 * Settings → Categories: the category MERGE.
 *
 * Covers the things the service tests cannot see: that the affordance exists
 * and is reachable, that a category which cannot be merged says so instead of
 * quietly doing nothing, that the confirmation spells out the consequence with
 * REAL counts before anything happens, and that confirming calls the one
 * atomic operation with the right two categories.
 *
 * Also pins the fix to the older "Delete & Reassign" flow: a category used only
 * by a BUDGET must still route through reassignment (deleting it outright left
 * that budget pointing at an id that no longer existed, silently reporting £0
 * spent for ever after), and that flow now runs through the same merge.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoriesSettings from './Categories';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Budget, Category, Transaction, TransactionSplit } from '../../types';

const toast = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn(),
  showToast: vi.fn(),
  dismissToast: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) =>
      Number(amount) < 0
        ? `(£${Math.abs(Number(amount)).toFixed(2)})`
        : `£${Number(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(),
    convertAndFormat: vi.fn(),
    convertAndSum: vi.fn(),
  }),
}));

const SOURCE = 'cat-food-shopping';
const TARGET = 'cat-groceries';

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: SOURCE, name: 'Food Shopping', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: TARGET, name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
  {
    id: 'transfer-joint', name: 'To/From Joint', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true,
  },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -20,
  description: 'Tesco',
  category: SOURCE,
  accountId: 'acc-current',
  type: 'expense',
  ...over,
});

/** Three whole rows, one split line inside a fourth, and one budget. */
const TRANSACTIONS: Transaction[] = [
  txn({ id: 'txn-a' }),
  txn({ id: 'txn-b' }),
  txn({ id: 'txn-c' }),
  txn({ id: 'txn-split', category: '', isSplit: true, amount: -60 }),
  txn({ id: 'txn-elsewhere', category: TARGET }),
];

const SPLITS: TransactionSplit[] = [
  { id: 's1', transactionId: 'txn-split', category: SOURCE, amount: -40, sortOrder: 1 },
  { id: 's2', transactionId: 'txn-split', category: TARGET, amount: -20, sortOrder: 2 },
];

const BUDGETS: Budget[] = [
  {
    id: 'bud-1', categoryId: SOURCE, amount: 400, period: 'monthly', isActive: true,
    spent: 0, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  },
];

const mergeCategories = vi.fn(async (sourceId: string, targetId: string) => ({
  sourceId,
  targetId,
  transactions: 3,
  splitLines: 1,
  splitTransactions: 1,
  budgets: 1,
  recurring: 0,
}));

const deleteCategory = vi.fn();

const setup = (overrides: Record<string, unknown> = {}): void => {
  __setAppContextValue({
    categories: CATEGORIES,
    transactions: TRANSACTIONS,
    transactionSplits: SPLITS,
    budgets: BUDGETS,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    mergeCategories,
    deleteCategory,
    ...overrides,
  });
  render(<MemoryRouter><CategoriesSettings /></MemoryRouter>);
};

/** Edit mode → Merge mode → expand Food, so the detail rows are on screen. */
const enterMergeMode = (): void => {
  fireEvent.click(screen.getByTitle('Edit Categories'));
  fireEvent.click(screen.getByTitle('Merge Categories'));
  fireEvent.click(screen.getByLabelText('Expand Food'));
};

/** Pick a target inside the dialog's category picker. */
const chooseTarget = (name: string): void => {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name }));
};

const flatten = (text: string | null | undefined): string =>
  (text ?? '').replace(/\s+/g, ' ').trim();

describe('Categories settings — merge', () => {
  beforeEach(() => {
    mergeCategories.mockClear();
    deleteCategory.mockClear();
    Object.values(toast).forEach(fn => fn.mockClear());
  });

  afterEach(() => {
    cleanup();
    __resetAppContextValue();
  });

  it('offers merge only inside edit mode', () => {
    setup();
    expect(screen.queryByTitle('Merge Categories')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Edit Categories'));
    expect(screen.getByTitle('Merge Categories')).toBeInTheDocument();
  });

  it('opens the merge dialog for a detail category', () => {
    setup();
    enterMergeMode();

    fireEvent.click(screen.getByTitle('Merge "Food Shopping" into another category'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Merge Category' })).toBeInTheDocument();
    expect(flatten(dialog.textContent)).toContain(
      'Everything filed under “Food Shopping” moves to the category you choose, and “Food Shopping” is then removed.'
    );
  });

  it('spells out exactly what moves, with real counts, before anything happens', () => {
    setup();
    enterMergeMode();
    fireEvent.click(screen.getByTitle('Merge "Food Shopping" into another category'));

    // Nothing is claimed until a target is named.
    expect(flatten(screen.getByRole('dialog').textContent)).not.toContain('move to');

    chooseTarget('Groceries');

    expect(flatten(screen.getByRole('dialog').textContent)).toContain(
      '3 transactions, 1 split line and 1 budget move to “Groceries”; “Food Shopping” is then removed. ' +
      'Payee memory and future imports follow “Groceries”.'
    );
    expect(mergeCategories).not.toHaveBeenCalled();
  });

  it('says nothing about counts that are zero', () => {
    setup({ transactions: [txn({ id: 'txn-elsewhere', category: TARGET })], transactionSplits: [], budgets: [] });
    enterMergeMode();
    fireEvent.click(screen.getByTitle('Merge "Food Shopping" into another category'));
    chooseTarget('Groceries');

    const text = flatten(screen.getByRole('dialog').textContent);
    expect(text).toContain('Nothing is filed under “Food Shopping”, so it is simply removed.');
    expect(text).not.toContain('0 transactions');
  });

  it('cannot be confirmed until a target is chosen', () => {
    setup();
    enterMergeMode();
    fireEvent.click(screen.getByTitle('Merge "Food Shopping" into another category'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Merge' })).toBeDisabled();

    chooseTarget('Groceries');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Merge' })).toBeEnabled();
  });

  it('confirming runs ONE merge and reports what the database moved', async () => {
    setup();
    enterMergeMode();
    fireEvent.click(screen.getByTitle('Merge "Food Shopping" into another category'));
    chooseTarget('Groceries');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(mergeCategories).toHaveBeenCalledTimes(1));
    expect(mergeCategories).toHaveBeenCalledWith(SOURCE, TARGET);
    // The old flow deleted the category as a separate step; the merge owns it.
    expect(deleteCategory).not.toHaveBeenCalled();

    await waitFor(() => expect(toast.showSuccess).toHaveBeenCalledWith(
      '3 transactions, 1 split line and 1 budget moved from "Food Shopping" to "Groceries".',
      'Categories merged'
    ));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('surfaces the database’s own refusal rather than a generic failure', async () => {
    mergeCategories.mockRejectedValueOnce(
      new Error('merge_direction_mismatch: "Food Shopping" is an expense category and "Salary" is an income one')
    );
    setup();
    enterMergeMode();
    fireEvent.click(screen.getByTitle('Merge "Food Shopping" into another category'));
    chooseTarget('Groceries');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(toast.showError).toHaveBeenCalled());
    expect(String(toast.showError.mock.calls[0][0])).toContain('merge_direction_mismatch');
    // The dialog stays open so the user can pick a different target.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('categories that cannot be merged explain themselves', () => {
    it('greys out a group and says why, instead of hiding it', () => {
      setup();
      enterMergeMode();

      const groupRow = screen.getByTitle(
        "Merging a whole group isn't supported yet — merge the detail categories inside it instead."
      );
      expect(groupRow.className).toContain('cursor-not-allowed');
      expect(groupRow.closest('.opacity-60')).not.toBeNull();

      fireEvent.click(groupRow);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(String(toast.showError.mock.calls[0][0])).toContain('Merging a whole group');
    });

    it('greys out an account’s transfer category and points at the account', () => {
      setup();
      enterMergeMode();

      const transferRow = screen.getByTitle(
        'Transfer categories are managed automatically from their account. Close the account to hide it instead.'
      );
      fireEvent.click(transferRow);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(String(toast.showError.mock.calls[0][0])).toContain('Close the account');
    });

    it('leaves every row clickable again once merge mode is off', () => {
      setup();
      enterMergeMode();
      fireEvent.click(screen.getByTitle('Cancel Merge'));

      expect(screen.queryByTitle('Merge "Food Shopping" into another category')).not.toBeInTheDocument();
    });
  });
});

describe('Categories settings — delete & reassign runs through the same merge', () => {
  beforeEach(() => {
    mergeCategories.mockClear();
    deleteCategory.mockClear();
    Object.values(toast).forEach(fn => fn.mockClear());
  });

  afterEach(() => {
    cleanup();
    __resetAppContextValue();
  });

  const enterDeleteMode = (): void => {
    fireEvent.click(screen.getByTitle('Edit Categories'));
    fireEvent.click(screen.getByTitle('Delete Categories'));
    fireEvent.click(screen.getByLabelText('Expand Food'));
  };

  it('routes a category with references through reassignment and merges in one call', async () => {
    setup();
    enterDeleteMode();

    fireEvent.click(screen.getByText('Food Shopping'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Delete Category' })).toBeInTheDocument();
    expect(flatten(dialog.textContent)).toContain(
      '3 transactions, 1 split line and 1 budget are filed under “Food Shopping”'
    );

    fireEvent.click(within(dialog).getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Groceries' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete & Reassign' }));

    await waitFor(() => expect(mergeCategories).toHaveBeenCalledWith(SOURCE, TARGET));
    // One atomic call — not a round trip per row, then a split rewrite, then a delete.
    expect(mergeCategories).toHaveBeenCalledTimes(1);
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it('a category used only by a BUDGET still asks where its budget should go', () => {
    // The regression: with no transactions the old flow deleted outright, and
    // the budget kept a dangling category id.
    setup({ transactions: [], transactionSplits: [] });
    enterDeleteMode();

    fireEvent.click(screen.getByText('Food Shopping'));

    expect(flatten(screen.getByRole('dialog').textContent)).toContain(
      '1 budget is filed under “Food Shopping”, so it needs somewhere to go'
    );
    expect(deleteCategory).not.toHaveBeenCalled();
  });
});
