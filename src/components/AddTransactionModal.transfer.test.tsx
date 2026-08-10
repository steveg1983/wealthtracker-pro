import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import AddTransactionModal from './AddTransactionModal';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Account, Category } from '../types';

/**
 * THE FULL ADD EDITOR'S TRANSFER — the worst version of this batch's bug.
 *
 * Its Transfer button used to write ONE row: typed 'transfer', with no target
 * account (the form had no field for one), no counterpart, no link, and signed
 * POSITIVE — so a transfer OUT of an account read as money IN. Nothing in the
 * app could ever pair it, and both accounts' balances were wrong.
 *
 * What it does now is what the register's dock does: names the other account,
 * writes the leaving row, and makes the other side through the one operation
 * that links the pair. Both legs, or neither.
 *
 * Every account, payee and figure below is invented: this repo is public.
 */

/**
 * UUID-shaped ids, not the friendly 'acc-daily' the register suites use: this
 * file drives a REAL save through ValidationService, which checks that ids are
 * UUIDs. A readable id fails validation and the write never happens, which
 * would make the assertions below pass or fail for the wrong reason.
 */
const DAILY_ID = '11111111-1111-4111-8111-111111111111';
const THRIFT_ID = '22222222-2222-4222-8222-222222222222';
const ABROAD_ID = '33333333-3333-4333-8333-333333333333';

const DAILY: Account = {
  id: DAILY_ID, name: 'Synthetic Daily', type: 'current', balance: 400,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), isActive: true,
};

const THRIFT: Account = {
  id: THRIFT_ID, name: 'Synthetic Thrift', type: 'savings', balance: 900,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), isActive: true,
};

const ABROAD: Account = {
  id: ABROAD_ID, name: 'Synthetic Abroad', type: 'savings', balance: 0,
  currency: 'EUR', lastUpdated: new Date('2026-01-01'), isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-greengrocer', name: 'Greengrocer', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type' },
  {
    id: 'tofrom-thrift', name: 'To/From Synthetic Thrift', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: THRIFT.id,
  },
];

const addTransaction = vi.fn();
const createTransferCounterpart = vi.fn();
const deleteTransaction = vi.fn();

vi.mock('../hooks/useTransactionNotifications', () => ({
  useTransactionNotifications: () => ({
    addTransaction: (row: unknown) => addTransaction(row),
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('./MarkdownEditor', () => ({ default: () => <div data-testid="markdown-editor" /> }));
vi.mock('./CategoryCreationModal', () => ({ default: () => null }));

const openModal = (): void => {
  render(
    <PreferencesProvider>
      <AddTransactionModal isOpen onClose={vi.fn()} initialAccountId={DAILY.id} />
    </PreferencesProvider>
  );
};

const fillDraft = (amount = '250'): void => {
  fireEvent.change(screen.getByLabelText('Transaction description'), {
    target: { value: 'Monthly saving' },
  });
  fireEvent.change(screen.getByLabelText('Transaction amount'), { target: { value: amount } });
};

/** The To Account picker's own option list — the page has two account pickers. */
const toAccountOptions = (): HTMLElement => {
  const listbox = document.querySelector('[role="listbox"]');
  if (!(listbox instanceof HTMLElement)) throw new Error('the To Account list is not open');
  return listbox;
};

const openToAccount = (): void => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Select the account to transfer to' }));
};

const chooseToAccount = (name: string): void => {
  openToAccount();
  fireEvent.click(within(toAccountOptions()).getByText(new RegExp(`^${name}`)));
};

const submit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /Add Transaction/i }));
};

beforeEach(() => {
  addTransaction.mockReset().mockResolvedValue({ id: 'txn-created' });
  createTransferCounterpart.mockReset().mockResolvedValue({});
  deleteTransaction.mockReset().mockResolvedValue(undefined);
  __setAppContextValue({
    accounts: [DAILY, THRIFT, ABROAD],
    categories: CATEGORIES,
    createTransferCounterpart,
    deleteTransaction,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
  });
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('the full add editor — Transfer', () => {
  it('asks which account the money moved to instead of a category', () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Select transfer transaction type' }));

    expect(screen.getByRole('combobox', { name: 'Select the account to transfer to' })).toBeInTheDocument();
    // A transfer is not filed under a category, so the category selects go.
    expect(screen.queryByLabelText('Select transaction category')).not.toBeInTheDocument();
  });

  it('writes the leaving row NEGATIVE and then makes the other side, linked', async () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Select transfer transaction type' }));
    fillDraft('250');
    chooseToAccount('Synthetic Thrift');
    submit();

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction.mock.calls[0][0]).toMatchObject({
      // Money LEAVING the account the form is on. This used to be +250.
      amount: -250,
      type: 'transfer',
      accountId: DAILY.id,
      transferAccountId: THRIFT.id,
      category: 'tofrom-thrift',
    });
    await waitFor(() =>
      expect(createTransferCounterpart).toHaveBeenCalledWith('txn-created', THRIFT.id)
    );
    // Never a second free-standing insert: that pair would not be linked.
    expect(addTransaction).toHaveBeenCalledTimes(1);
  });

  it('removes the first leg when the other side cannot be made', async () => {
    createTransferCounterpart.mockRejectedValue(new Error('the target account refused'));
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Select transfer transaction type' }));
    fillDraft();
    chooseToAccount('Synthetic Thrift');
    submit();

    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith('txn-created'));
  });

  it('refuses a cross-currency transfer before writing anything', async () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Select transfer transaction type' }));
    fillDraft();
    chooseToAccount('Synthetic Abroad');
    submit();

    expect(await screen.findByText(/different currencies/)).toBeInTheDocument();
    expect(addTransaction).not.toHaveBeenCalled();
  });

  it('never offers the account the transfer is coming FROM', () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Select transfer transaction type' }));
    openToAccount();

    const options = within(toAccountOptions());
    expect(options.getByText(/^Synthetic Thrift/)).toBeInTheDocument();
    // A transfer from an account to itself moves nothing and has no other side.
    expect(options.queryByText(/^Synthetic Daily/)).not.toBeInTheDocument();
  });

  it('still adds an ordinary expense, signed and categorised as before', async () => {
    openModal();
    fillDraft('42');
    fireEvent.change(screen.getByLabelText('Select transaction category'), {
      target: { value: 'grp-food' },
    });
    fireEvent.change(screen.getByLabelText('Select transaction sub-category'), {
      target: { value: 'det-greengrocer' },
    });
    submit();

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction.mock.calls[0][0]).toMatchObject({
      amount: -42,
      type: 'expense',
      category: 'det-greengrocer',
    });
    expect(createTransferCounterpart).not.toHaveBeenCalled();
  });
});
