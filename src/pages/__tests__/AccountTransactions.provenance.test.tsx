/**
 * The account register's category column, when the app was the one who filled
 * it in.
 *
 * The owner's requirement, in his words: "If it is a 'suggested' category, it
 * has a different colour or something and then the user has to somehow do an
 * easy 'confirm or edit' when he clicks on the category."
 *
 * So the register has to answer three things, and each has a test here:
 *   1. a guessed category is visibly and TEXTUALLY marked, in the row itself;
 *   2. a category the user stands behind carries no extra chrome at all —
 *      including the rows of every database that has not had the migration,
 *      which carry no flag and must read as the user's own;
 *   3. one click on that category reaches the confirm-or-edit the quick-edit
 *      panel already provides. No second confirm mechanism, and no journey.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

const ACCOUNT: Account = {
  id: 'acc-register', name: 'Synthetic Register', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const OTHER_ACCOUNT: Account = {
  id: 'acc-other', name: 'Synthetic Savings', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const base = {
  date: new Date('2024-03-01'),
  amount: -21.5,
  type: 'expense' as const,
  category: 'det-groceries',
  accountId: ACCOUNT.id,
  cleared: false,
};

/** The app guessed this one, and nobody has agreed with it yet. */
const GUESSED: Transaction = {
  ...base, id: 'txn-guessed', description: 'Synthetic guessed row', categoryConfirmed: false,
};

/** The user filed this one themselves. */
const VOUCHED: Transaction = {
  ...base, id: 'txn-vouched', description: 'Synthetic vouched row', date: new Date('2024-03-02'),
  categoryConfirmed: true,
};

/** No flag at all — a pre-migration row, or one from the local/demo store. */
const UNMARKED: Transaction = {
  ...base, id: 'txn-unmarked', description: 'Synthetic unmarked row', date: new Date('2024-03-03'),
};

/**
 * A transfer whose category is somehow marked unconfirmed. Its category is the
 * system To/From category that follows the account it moves money to: there is
 * no judgement to make, and the quick-edit panel offers no Confirm for it. A
 * badge here would be an accusation with no reply.
 */
const TRANSFER: Transaction = {
  ...base, id: 'txn-transfer', description: 'Synthetic transfer row', date: new Date('2024-03-04'),
  type: 'transfer', category: 'det-groceries', categoryConfirmed: false,
  transferAccountId: OTHER_ACCOUNT.id,
};

const ROWS = [GUESSED, VOUCHED, UNMARKED, TRANSFER];

const renderRegister = (): void => {
  render(
    <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}`]}>
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

/**
 * The register itself. Scoped deliberately: jsdom applies no media queries, so
 * the phone card list is in the document too — and this file is about the
 * desktop register's column.
 */
const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

/** The register line showing `description`. */
const row = (description: string): HTMLElement => {
  const cell = within(grid()).getByText(description);
  const found = cell.closest('[role="row"]');
  if (!(found instanceof HTMLElement)) throw new Error(`no register row for "${description}"`);
  return found;
};

/** The quick-edit box the register opens under a clicked row. */
const quickEditBox = (): HTMLElement => {
  const el = document.querySelector('[data-quick-edit-panel]');
  if (!(el instanceof HTMLElement)) throw new Error('no quick-edit box is showing');
  return el;
};

const openRegister = async (): Promise<void> => {
  renderRegister();
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
};

beforeEach(() => {
  localStorage.clear();
  __setAppContextValue({
    accounts: [ACCOUNT, OTHER_ACCOUNT],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
  });
  vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.getClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — a category the app guessed', () => {
  it('marks the row in words, not only in colour', async () => {
    await openRegister();

    // Colour alone says nothing to someone who cannot separate amber from grey,
    // and nothing at all in a screenshot pasted into an email (WCAG 1.4.1).
    expect(within(row('Synthetic guessed row')).getByText('Suggested')).toBeInTheDocument();
    // …and the category it is about is still there to read beside it.
    expect(within(row('Synthetic guessed row')).getByText('Food > Groceries')).toBeInTheDocument();
  });

  it('spells the provenance out for a screen reader, which cannot see amber', async () => {
    await openRegister();

    expect(
      within(row('Synthetic guessed row')).getByText(/category — not confirmed yet/)
    ).toBeInTheDocument();
  });

  it('leaves a category the user stands behind completely alone', async () => {
    await openRegister();

    // Nothing extra where there is nothing to say. A register that marks every
    // row marks nothing.
    expect(within(row('Synthetic vouched row')).queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('treats a row with no provenance flag as the user\'s own', async () => {
    await openRegister();

    // The load-bearing asymmetry: only `false` means suggested. A database
    // without the migration returns no such key, and reading that as a guess
    // would badge every transaction the user has ever typed.
    expect(within(row('Synthetic unmarked row')).queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('never marks a transfer, whose category is not a judgement to make', async () => {
    await openRegister();

    expect(within(row('Synthetic transfer row')).queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('reaches confirm-or-edit in the one click the register already takes', async () => {
    await openRegister();

    // Clicking the CATEGORY of a guessed row — the thing the user is querying.
    fireEvent.click(within(row('Synthetic guessed row')).getByText('Food > Groceries'));

    // The click opens the quick-edit box under that very row, and the box is
    // where confirm-or-edit lives. No second mechanism was invented for the
    // register, and nothing else stands between the click and the answer.
    const confirm = within(quickEditBox()).getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeInTheDocument();
    expect(within(quickEditBox()).getByLabelText('Description')).toHaveValue('Synthetic guessed row');
  });

  it('offers no Confirm when the row clicked is one the user already vouched for', async () => {
    await openRegister();

    fireEvent.click(within(row('Synthetic vouched row')).getByText('Synthetic vouched row'));

    expect(within(quickEditBox()).getByLabelText('Description')).toHaveValue('Synthetic vouched row');
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });
});
