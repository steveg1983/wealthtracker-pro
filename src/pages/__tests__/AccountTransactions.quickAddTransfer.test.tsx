import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * THE DOCK CANNOT WRITE HALF A TRANSFER.
 *
 * Two reports, one disease. Pressing Add with the Txfr toggle on produced ONE
 * row: the second write was guarded by `if (… && created)` on a value the
 * context declared as `void`, so it never ran, and what landed in the register
 * was a row pointing at an account with nothing in it pointing back. And a row
 * carrying a "To/From <account>" CATEGORY under the Exp/Inc type was written
 * exactly as typed — filed as a transfer, typed as spending, with no other
 * side at all.
 *
 * What is asserted here is the cure for both: the dock writes the row and then
 * calls the ONE operation that makes a pair of it — createTransferCounterpart,
 * which types both sides, files both under the opposite account's To/From
 * category, links them each way and moves the target balance. Two independent
 * inserts would look the same on screen and would not be a transfer: neither
 * row would carry linkedTransferId, so nothing would tie them together.
 *
 * WHAT JSDOM CANNOT DO, said rather than pretended at: it performs no layout,
 * so nothing here proves the dock looks right when the type flips. What it CAN
 * prove is which write is called with which arguments, and that is what every
 * test below asserts.
 *
 * Every account, payee and figure is invented: this repo is public.
 */

const DAILY: Account = {
  id: 'acc-daily', name: 'Synthetic Daily', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const THRIFT: Account = {
  id: 'acc-thrift', name: 'Synthetic Thrift', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

/** Held in another currency, so the pre-flight has something to refuse. */
const ABROAD: Account = {
  id: 'acc-abroad', name: 'Synthetic Abroad', type: 'savings', balance: 0,
  currency: 'EUR', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-greengrocer', name: 'Greengrocer', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
  {
    id: 'tofrom-thrift', name: 'To/From Synthetic Thrift', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: THRIFT.id,
  },
  {
    id: 'tofrom-daily', name: 'To/From Synthetic Daily', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: DAILY.id,
  },
];

/**
 * The row report 2 is about: a feed row typed EXPENSE, filed under the other
 * account's To/From category, with no counterpart. It is in the register so
 * Ctrl+D can copy it — the route by which one such row becomes two.
 */
const INCOHERENT: Transaction = {
  id: 'txn-incoherent', date: new Date(Date.UTC(2026, 2, 3)), description: 'Standing order',
  amount: -75, type: 'expense', category: 'tofrom-thrift', accountId: DAILY.id, cleared: false,
};

const ROWS: Transaction[] = [
  {
    id: 'txn-shop', date: new Date(Date.UTC(2026, 2, 1)), description: 'Marrow & Vine',
    amount: -14.2, type: 'expense', category: 'det-greengrocer', accountId: DAILY.id, cleared: false,
  },
  INCOHERENT,
];

const addTransaction = vi.fn();
const createTransferCounterpart = vi.fn();
const deleteTransaction = vi.fn();

const renderRegister = (): void => {
  render(
    <MemoryRouter initialEntries={[`/accounts/${DAILY.id}`]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const addBar = (): HTMLElement => screen.getByRole('form', { name: 'Quick Add Transaction' });
const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Daily transactions' });

const descriptionBox = (): HTMLInputElement => {
  const el = within(addBar()).getByLabelText('Description');
  if (!(el instanceof HTMLInputElement)) throw new Error('the Description field is not an input');
  return el;
};

const amountBox = (): HTMLInputElement => {
  const el = within(addBar()).getByLabelText('Amount');
  if (!(el instanceof HTMLInputElement)) throw new Error('the Amount field is not an input');
  return el;
};

const addButton = (): HTMLElement => within(addBar()).getByRole('button', { name: 'Add' });
const txfrButton = (): HTMLElement => within(addBar()).getByRole('button', { name: 'Txfr' });
const toAccountBox = (): HTMLElement => within(addBar()).getByRole('combobox', { name: 'To Account' });

const openRegister = async (): Promise<void> => {
  renderRegister();
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Daily' });
};

/** Choose an account in the To Account picker by its name. */
const chooseToAccount = (name: string): void => {
  fireEvent.click(toAccountBox());
  fireEvent.click(screen.getByText(new RegExp(`^${name}`)));
};

const fillDraft = (description: string, amount: string): void => {
  fireEvent.change(descriptionBox(), { target: { value: description } });
  fireEvent.change(amountBox(), { target: { value: amount } });
};

beforeEach(() => {
  localStorage.clear();
  addTransaction.mockReset().mockResolvedValue({ ...INCOHERENT, id: 'txn-created' });
  createTransferCounterpart.mockReset().mockResolvedValue({});
  deleteTransaction.mockReset().mockResolvedValue(undefined);
  __setAppContextValue({
    accounts: [DAILY, THRIFT, ABROAD],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
    addTransaction,
    createTransferCounterpart,
    deleteTransaction,
    // The REAL context's walkers: children by parentId, with no level filter.
    // A double that filtered by level would hide the very tree shape the
    // picker's transfer exclusion is about.
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Quick Add — the Txfr toggle writes BOTH legs', () => {
  it('adds the row and then makes its other side, linked', async () => {
    await openRegister();

    fireEvent.click(txfrButton());
    fillDraft('Monthly saving', '120');
    chooseToAccount('Synthetic Thrift');
    fireEvent.click(addButton());

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));

    // ONE insert — the source leg, in this account, money out, pointing at the
    // target and filed under the TARGET's To/From category (never the legacy
    // 'transfer-out' sentinel, which names no account at all).
    const written = addTransaction.mock.calls[0][0];
    expect(written).toMatchObject({
      description: 'Monthly saving',
      amount: -120,
      type: 'transfer',
      accountId: DAILY.id,
      transferAccountId: THRIFT.id,
      category: 'tofrom-thrift',
    });

    // …and the other side made by the one operation that LINKS the pair,
    // rather than by a second blind insert.
    await waitFor(() => expect(createTransferCounterpart).toHaveBeenCalledWith('txn-created', THRIFT.id));
    expect(addTransaction).toHaveBeenCalledTimes(1);
  });

  it('removes the first leg when the other side cannot be made', async () => {
    createTransferCounterpart.mockRejectedValue(new Error('the other account is having none of it'));
    await openRegister();

    fireEvent.click(txfrButton());
    fillDraft('Monthly saving', '120');
    chooseToAccount('Synthetic Thrift');
    fireEvent.click(addButton());

    // Both legs or neither: a lone leg reads as a real payment out of an
    // account, and nothing anywhere answers for it.
    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith('txn-created'));
    expect(await screen.findByText(/having none of it/)).toBeInTheDocument();
  });

  it('refuses a cross-currency transfer before writing anything at all', async () => {
    await openRegister();

    fireEvent.click(txfrButton());
    fillDraft('Holiday float', '200');
    chooseToAccount('Synthetic Abroad');
    fireEvent.click(addButton());

    expect(await screen.findByText(/different currencies/)).toBeInTheDocument();
    // Not written and then undone — never written. A create-then-delete would
    // leave two entries in the audit trail for a transfer that never existed.
    expect(addTransaction).not.toHaveBeenCalled();
    expect(createTransferCounterpart).not.toHaveBeenCalled();
  });

  it('blocks an unfinished transfer rather than adding a half of one', async () => {
    await openRegister();

    fireEvent.click(txfrButton());
    fillDraft('Monthly saving', '120');
    fireEvent.click(addButton());

    expect(await screen.findByText('Please choose the account to transfer to')).toBeInTheDocument();
    expect(addTransaction).not.toHaveBeenCalled();
  });
});

describe('Quick Add — a transfer CATEGORY means a transfer', () => {
  /**
   * The register's inline editor treats a "To/From <account>" category as the
   * Transfer toggle with that account chosen. The dock now says the same thing
   * the way a form can: it flips its own Type and fills in the To Account,
   * where the user can see it, BEFORE anything is written.
   *
   * Ctrl+D is the route a transfer category reaches this form by — the pickers
   * no longer offer one (see CategorySelector), and this is exactly how one
   * incoherent row used to become two.
   */
  it('copies a row filed under a To/From category as the transfer it claims to be', async () => {
    await openRegister();

    fireEvent.click(within(grid()).getByText('Standing order'));
    fireEvent.keyDown(grid(), { key: 'd', ctrlKey: true });

    // The dock is now a TRANSFER draft aimed at the account the category names.
    await waitFor(() => expect(txfrButton()).toHaveAttribute('aria-pressed', 'true'));
    expect(toAccountBox()).toHaveTextContent('Synthetic Thrift');
  });

  it('writes both legs when that copy is added', async () => {
    await openRegister();

    fireEvent.click(within(grid()).getByText('Standing order'));
    fireEvent.keyDown(grid(), { key: 'd', ctrlKey: true });
    await waitFor(() => expect(txfrButton()).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(addButton());

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction.mock.calls[0][0]).toMatchObject({
      type: 'transfer',
      transferAccountId: THRIFT.id,
      category: 'tofrom-thrift',
    });
    await waitFor(() => expect(createTransferCounterpart).toHaveBeenCalledWith('txn-created', THRIFT.id));
  });
});

describe('Quick Add — the owner’s exact gesture', () => {
  /**
   * "Chose a Transfer category from the category dropdown, pressed Add." What
   * that used to produce was ONE row, categorised as a transfer, typed expense,
   * with no counterpart and no link. What it produces now is a transfer.
   */
  const chooseCategory = async (name: string): Promise<void> => {
    fireEvent.click(within(addBar()).getByRole('combobox', { name: 'Category' }));
    fireEvent.click(await screen.findByText(name));
  };

  it('offers the other account’s To/From category, but never this account’s own', async () => {
    await openRegister();

    fireEvent.click(within(addBar()).getByRole('combobox', { name: 'Category' }));

    expect(await screen.findByText('Greengrocer')).toBeInTheDocument();
    expect(screen.getByText('To/From Synthetic Thrift')).toBeInTheDocument();
    // A transfer from an account to itself moves nothing and has no other side
    // to create, so it is left out rather than offered and then refused.
    expect(screen.queryByText('To/From Synthetic Daily')).not.toBeInTheDocument();
  });

  it('turns the dock into a transfer draft the moment one is chosen', async () => {
    await openRegister();
    fillDraft('Monthly saving', '120');

    await chooseCategory('To/From Synthetic Thrift');

    // The conversion is VISIBLE, before anything is written — the type flips
    // and the account lands in the To Account slot, where it can be corrected.
    expect(txfrButton()).toHaveAttribute('aria-pressed', 'true');
    expect(toAccountBox()).toHaveTextContent('Synthetic Thrift');
  });

  it('writes both legs, linked, when Add is then pressed', async () => {
    await openRegister();
    fillDraft('Monthly saving', '120');
    await chooseCategory('To/From Synthetic Thrift');

    fireEvent.click(addButton());

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction.mock.calls[0][0]).toMatchObject({
      type: 'transfer',
      amount: -120,
      accountId: DAILY.id,
      transferAccountId: THRIFT.id,
      category: 'tofrom-thrift',
    });
    await waitFor(() => expect(createTransferCounterpart).toHaveBeenCalledWith('txn-created', THRIFT.id));
    // Never a second free-standing insert: that pair would not be linked.
    expect(addTransaction).toHaveBeenCalledTimes(1);
  });
});
