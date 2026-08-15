/**
 * Settings → Categories: marking a category as an ADJUSTMENT.
 *
 * The case this exists for is real data: Microsoft Money creates a category
 * called "Xfer to Deleted Account" when you delete an account that had
 * transfers, and types it as an expense. Those transfers have no other side —
 * money moved, but nobody spent it — so left as an expense the category lands in
 * the report as spending that never happened.
 *
 * The importer now flags such categories on the way in, but a category already
 * sitting in someone's tree can only be fixed by hand, which means the page has
 * to OFFER the property. These tests pin that: it is reachable, it explains what
 * it means, it states the consequence with the real count BEFORE saving, and
 * saving sends exactly the one field change.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoriesSettings from './Categories';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Category, Transaction } from '../../types';

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

const XFER = 'cat-xfer-deleted';

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
  // Exactly as a Money import used to land it: a top-level expense group.
  { id: XFER, name: 'Xfer to Deleted Account', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
  {
    id: 'transfer-joint', name: 'To/From Joint', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true,
  },
];

const txn = (id: string, category: string): Transaction => ({
  id,
  date: new Date('2026-05-01'),
  amount: -1000,
  description: 'Old transfer',
  category,
  accountId: 'acc-current',
  type: 'expense',
});

const TRANSACTIONS: Transaction[] = [
  txn('t1', XFER),
  txn('t2', XFER),
  txn('t3', XFER),
  txn('t4', 'cat-groceries'),
];

const updateCategory = vi.fn(async () => undefined);

const setup = (overrides: Record<string, unknown> = {}): void => {
  __setAppContextValue({
    categories: CATEGORIES,
    transactions: TRANSACTIONS,
    transactionSplits: [],
    budgets: [],
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    updateCategory,
    ...overrides,
  });
  render(<MemoryRouter><CategoriesSettings /></MemoryRouter>);
};

/** Edit mode, then click the category name — the page's one way in. */
const openEditor = (name: string): void => {
  fireEvent.click(screen.getByTitle('Edit Categories'));
  fireEvent.click(screen.getByTitle(`Edit "${name}"`));
};

const adjustmentCheckbox = (): HTMLElement =>
  within(screen.getByRole('dialog')).getByRole('checkbox', {
    name: /adjustment, not income or spending/i,
  });

const flatten = (text: string | null | undefined): string =>
  (text ?? '').replace(/\s+/g, ' ').trim();

describe('Categories settings — marking a category as an adjustment', () => {
  beforeEach(() => {
    updateCategory.mockClear();
    Object.values(toast).forEach(fn => fn.mockClear());
  });

  afterEach(() => {
    cleanup();
    __resetAppContextValue();
  });

  it('offers the property alongside the name, and explains what it means', () => {
    setup();
    openEditor('Xfer to Deleted Account');

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit category' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Xfer to Deleted Account');
    expect(adjustmentCheckbox()).not.toBeChecked();
    expect(flatten(dialog.textContent)).toContain(
      'Money that moved but was neither earned nor spent — kept out of income and expense totals'
    );
  });

  it('states the consequence with the real count before anything is saved', () => {
    setup();
    openEditor('Xfer to Deleted Account');

    // Nothing is claimed until the answer actually changes.
    expect(flatten(screen.getByRole('dialog').textContent)).not.toContain('Saving re-files');

    fireEvent.click(adjustmentCheckbox());

    expect(flatten(screen.getByRole('dialog').textContent)).toContain(
      'Saving re-files the 3 transactions in this category out of Expenses and into gains, ' +
      'losses and adjustments — in every report, for every period, back to the start of your history.'
    );
    expect(updateCategory).not.toHaveBeenCalled();
  });

  it('says nothing about re-filing when the category holds nothing', () => {
    setup({ transactions: [txn('t4', 'cat-groceries')] });
    openEditor('Xfer to Deleted Account');
    fireEvent.click(adjustmentCheckbox());

    const text = flatten(screen.getByRole('dialog').textContent);
    expect(text).not.toContain('0 transactions');
    expect(text).not.toContain('Saving re-files');
  });

  it('saves the flag, and only sends what the user changed', async () => {
    setup();
    openEditor('Xfer to Deleted Account');
    fireEvent.click(adjustmentCheckbox());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(1));
    expect(updateCategory).toHaveBeenCalledWith(XFER, {
      name: 'Xfer to Deleted Account',
      isRevaluationCategory: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('can be turned back off again, and says so in the other direction', () => {
    setup({
      categories: CATEGORIES.map(c => (c.id === XFER ? { ...c, isRevaluationCategory: true } : c)),
    });
    openEditor('Xfer to Deleted Account');

    expect(adjustmentCheckbox()).toBeChecked();
    fireEvent.click(adjustmentCheckbox());

    expect(flatten(screen.getByRole('dialog').textContent)).toContain(
      'Saving puts the 3 transactions in this category back into your Expenses totals'
    );
  });

  it('nothing to save until something changes', () => {
    setup();
    openEditor('Xfer to Deleted Account');

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeDisabled();

    fireEvent.click(adjustmentCheckbox());
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('renames through the same dialog', async () => {
    setup();
    openEditor('Food');

    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Name'), {
      target: { value: 'Food & Drink' },
    });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalledWith('sub-food', {
      name: 'Food & Drink',
      isRevaluationCategory: false,
    }));
  });

  it('an account’s transfer category is still redirected to its account, not edited here', () => {
    setup();
    fireEvent.click(screen.getByTitle('Edit Categories'));
    fireEvent.click(screen.getByTitle('Edit "To/From Joint"'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(String(toast.showError.mock.calls[0][0])).toContain('Rename the account');
  });
});
