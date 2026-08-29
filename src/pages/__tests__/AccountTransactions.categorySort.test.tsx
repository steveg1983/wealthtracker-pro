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

/**
 * Sorting the register by Category — read off the column itself.
 *
 * The owner: sorted by Category and got his rows in DATE order, with blank
 * categories and transfer-categorised rows interleaved.
 *
 * ─ WHY A TEST THROUGH THE REGISTER, NOT THE COMPARATOR ─────────────────────
 * The comparator was never the whole story, and a unit test on it would have
 * agreed with itself. The register's Category column and the register's sort
 * key were computed by two DIFFERENT functions:
 *
 *   the column   getCategoryName — "Transfer > Savings" for a transfer,
 *                "Food > Groceries" for a filed row (parent AND leaf);
 *   the sort key categories.find(c => c.id === t.category)?.name — the LEAF
 *                only, and nothing at all for a transfer whose category is the
 *                literal 'transfer-out' the quick-add dock writes.
 *
 * So every transfer row scored the same as every blank row (both ''), and the
 * comparator's chronological tie-break then laid that whole block out in date
 * order — which is exactly what he saw. And the rows that DID resolve came out
 * ordered by their leaf ("Groceries", "Insurance", "Water") while the column
 * showed their paths ("Food >", "Home >", "Bills >"), so even the categorised
 * block read as unsorted.
 *
 * Every assertion below therefore reads the rendered Category cells in rendered
 * order: what the user actually sees, down the page.
 *
 * Fewer than fifty rows, so the register renders every one of them (over that
 * it hands the rows to react-window and only a window of them exists). The
 * ORDER is settled before either path sees it — accountTransactions — so the
 * short list proves the order for the long one.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-register', name: 'Synthetic Register', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const SAVINGS: Account = {
  id: 'acc-savings', name: 'Synthetic Savings', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

/**
 * Three filed categories whose LEAF order is not their PATH order — which is
 * the whole point of choosing them: leaf-sorted they read Groceries, Insurance,
 * Water; path-sorted they read Bills, Food, Home. One of those two is what the
 * column shows.
 */
const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-bills', name: 'Bills', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-water', name: 'Water', type: 'expense', level: 'detail', parentId: 'grp-bills' },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'grp-home', name: 'Home', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-insurance', name: 'Insurance', type: 'expense', level: 'detail', parentId: 'grp-home' },
];

const row = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'description'>): Transaction => ({
  amount: -10,
  type: 'expense',
  accountId: ACCOUNT.id,
  category: '',
  cleared: false,
  ...over,
});

/**
 * Eight rows whose dates deliberately disagree with their categories, so a
 * result in date order cannot be mistaken for a result in category order.
 */
const ROWS: Transaction[] = [
  row({ id: 'r-groceries', date: new Date(Date.UTC(2024, 0, 9)), description: 'Corner Market', category: 'det-groceries' }),
  row({ id: 'r-blank-old', date: new Date(Date.UTC(2024, 0, 30)), description: 'Unnamed debit' }),
  // The literal 'transfer-out' the register's own quick-add dock writes when a
  // transfer is entered by hand: displayed as "Transfer > Synthetic Savings",
  // and matching no category id anywhere.
  row({
    id: 'r-transfer-early', date: new Date(Date.UTC(2024, 1, 11)), description: 'Sweep to savings',
    type: 'transfer', amount: -250, category: 'transfer-out', transferAccountId: SAVINGS.id,
  }),
  row({ id: 'r-water-old', date: new Date(Date.UTC(2024, 2, 2)), description: 'Aqua Utilities quarter one', category: 'det-water' }),
  row({ id: 'r-insurance', date: new Date(Date.UTC(2024, 4, 21)), description: 'Harbour Insurance', category: 'det-insurance' }),
  row({
    id: 'r-transfer-late', date: new Date(Date.UTC(2024, 5, 3)), description: 'Standing order to savings',
    type: 'transfer', amount: -100, category: 'transfer-out', transferAccountId: SAVINGS.id,
  }),
  row({ id: 'r-water-new', date: new Date(Date.UTC(2024, 6, 14)), description: 'Aqua Utilities quarter two', category: 'det-water' }),
  row({ id: 'r-blank-new', date: new Date(Date.UTC(2024, 7, 4)), description: 'Unrecognised card payment' }),
];

const TRANSFER_LABEL = 'Transfer > Synthetic Savings';

const renderRegister = (): void => {
  render(
    <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}`]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts" element={<div>Accounts page</div>} />
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

/** Which cell of a row holds the named column, read off the header itself. */
const columnIndex = (header: string): number => {
  const headers = Array.from(grid().querySelectorAll('[role="columnheader"]'));
  const index = headers.findIndex(cell => (cell.textContent ?? '').trim().startsWith(header));
  if (index === -1) throw new Error(`the register has no ${header} column`);
  return index;
};

/** The transaction rows, in the order they are drawn (the lead summary aside). */
const dataRows = (): HTMLElement[] =>
  Array.from(grid().querySelectorAll<HTMLElement>('[role="row"][id]'))
    .filter(el => !el.id.endsWith('-row-opening-balance'));

const columnInOrder = (header: string): string[] => {
  const index = columnIndex(header);
  return dataRows().map(el => {
    const cell = el.querySelectorAll('[role="gridcell"]')[index];
    if (!cell) return '';
    // These are tests about ORDER, so screen-reader-only annotations (the
    // register's "— awaiting review" on a bold row) are stripped rather than
    // baked into every expectation: the fixtures' blank-category rows flag
    // under the 29 Aug ruling, and the wording of the mark must be free to
    // change without pretending the sort moved.
    const clone = cell.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.sr-only').forEach(node => node.remove());
    return (clone.textContent ?? '').trim();
  });
};

const sortBy = (header: string): void => {
  fireEvent.click(within(grid()).getByRole('button', { name: new RegExp(`^${header}`) }));
};

beforeEach(() => {
  localStorage.clear();
  __setAppContextValue({
    accounts: [ACCOUNT, SAVINGS],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — sorting by Category sorts by what the column says', () => {
  it('groups the column alphabetically instead of leaving it in date order', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    sortBy('Category');

    // The column, read down the page. Every group is contiguous and the groups
    // are in the order the eye expects them — which is the order of the text in
    // front of it, paths and all, not of the leaf names hidden behind it.
    expect(columnInOrder('Category')).toEqual([
      'Bills > Water',
      'Bills > Water',
      'Food > Groceries',
      'Home > Insurance',
      TRANSFER_LABEL,
      TRANSFER_LABEL,
      '',
      '',
    ]);
  });

  it('keeps a category group in date order within itself', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    sortBy('Category');

    // Two water bills and two sweeps: within their group each pair reads
    // oldest first, so a group is still a little register of its own.
    expect(columnInOrder('Description')).toEqual([
      'Aqua Utilities quarter one',
      'Aqua Utilities quarter two',
      'Corner Market',
      'Harbour Insurance',
      'Sweep to savings',
      'Standing order to savings',
      'Unnamed debit',
      'Unrecognised card payment',
    ]);
  });

  it('never lets a transfer row score the same as an uncategorised one', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    sortBy('Category');

    // THE BUG, named. A transfer entered by hand carries the literal category
    // 'transfer-out', which matches no category id anywhere — so it used to
    // score exactly what a blank row scores, and the two kinds were laid out
    // together in date order. The column tells them apart; so must the sort.
    const column = columnInOrder('Category');
    const firstBlank = column.indexOf('');
    const lastTransfer = column.lastIndexOf(TRANSFER_LABEL);
    expect(lastTransfer).toBeGreaterThanOrEqual(0);
    expect(firstBlank).toBeGreaterThan(lastTransfer);
  });
});

describe('Account register — where the uncategorised rows go', () => {
  it('gathers every blank at the FOOT under ascending — where the register opens', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    sortBy('Category');

    const column = columnInOrder('Category');
    expect(column.slice(-2)).toEqual(['', '']);
    // …and nowhere else: one block, not two.
    expect(column.filter(text => text === '')).toHaveLength(2);
    expect(column.indexOf('')).toBe(column.length - 2);
  });

  it('does not throw away the reader\'s place to do it', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    // The premise the choice of end rests on, asserted rather than assumed:
    // clicking a column header re-orders the rows and asks for no scroll at
    // all, so the register is still showing whatever it was showing. Since it
    // OPENS at the foot (Money's habit — see the keyboard suite), a first click
    // on Category puts the uncategorised block exactly where the eyes already
    // are. If a re-sort ever started jumping to the top, this test fails and
    // the argument for uncategorised-last fails with it.
    const list = grid().querySelector('[data-virtualized-list]');
    if (!(list instanceof HTMLElement)) throw new Error('the register rendered no scroll container');
    list.scrollTop = 137;

    sortBy('Category');

    expect(list.scrollTop).toBe(137);
  });

  it('flips them to the head under descending', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    sortBy('Category');
    sortBy('Category');

    // The named groups reverse; the blanks move to the other end with them, so
    // either click reaches the work queue in one move. Within a group the rows
    // stay oldest-first — the tie-break is the order the balances run in, and
    // it does not flip with the column.
    expect(columnInOrder('Category')).toEqual([
      '',
      '',
      TRANSFER_LABEL,
      TRANSFER_LABEL,
      'Home > Insurance',
      'Food > Groceries',
      'Bills > Water',
      'Bills > Water',
    ]);
    expect(columnInOrder('Description').slice(0, 2)).toEqual([
      'Unnamed debit',
      'Unrecognised card payment',
    ]);
  });
});

describe('Account register — the Balance column under a Category sort', () => {
  it('keeps every figure true, and says the column has stopped running', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    sortBy('Category');

    // Each row still carries what the account was worth immediately after that
    // transaction — the balances are accumulated in chronological order and
    // mapped back per row, so re-ordering the rows cannot make one wrong. Read
    // in the new order they no longer run down the page, which is precisely
    // what the line beneath the table says.
    expect(columnInOrder('Balance')).toEqual([
      '(£180.00)', // Aqua quarter one
      '(£300.00)', // Aqua quarter two
      '£90.00',   // Corner Market
      '(£190.00)', // Harbour Insurance
      '(£170.00)', // Sweep to savings
      '(£290.00)', // Standing order to savings
      '£80.00',   // Unnamed debit
      '(£310.00)', // Unrecognised card payment
    ]);
    expect(
      screen.getByText(/Sorted by Category, so the Balance column doesn't run down the page/)
    ).toBeInTheDocument();
  });
});

describe('Account register — the other sortable columns are unaffected', () => {
  it('still groups a payee under Description, oldest first inside the group', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    sortBy('Description');

    // Description's key and Description's cell were always the same string, so
    // this column never had the defect — asserted so that giving Category its
    // own key cannot quietly cost the columns that were already right.
    expect(columnInOrder('Description')).toEqual([
      'Aqua Utilities quarter one',
      'Aqua Utilities quarter two',
      'Corner Market',
      'Harbour Insurance',
      'Standing order to savings',
      'Sweep to savings',
      'Unnamed debit',
      'Unrecognised card payment',
    ]);
  });

  it('still orders Amount by the signed figure that column shows', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    sortBy('Deposit');

    // The money columns order by the SIGNED amount — which is what the Amount
    // column itself shows, and the deliberate decision recorded in
    // transactionSortValue. Payment and Deposit are two views of that one
    // number, so both read as one run from the largest payment to the largest
    // deposit. Asserted here as a guard, not as an endorsement: the Payment
    // column prints magnitudes, so "Payment ↑" leading with the biggest
    // payment is a mismatch of its own — reported, deliberately not changed.
    expect(columnInOrder('Description')).toEqual([
      'Sweep to savings',
      'Standing order to savings',
      'Corner Market',
      'Unnamed debit',
      'Aqua Utilities quarter one',
      'Harbour Insurance',
      'Aqua Utilities quarter two',
      'Unrecognised card payment',
    ]);
  });
});

/**
 * The same resolver again, in the third place that reads the column: SEARCH.
 *
 * The register's search matched the category's LEAF name alone — a
 * `categories.find(...)?.name` of its own, the last survivor of the pair of
 * lookups that put the column and the sort out of step. So typing "Bills",
 * which is what the user is looking straight at in the column, found nothing at
 * all: the parent was the one part of the label the search could not see. A
 * transfer was worse — its label is resolved from the account it faces and
 * never was a category name, so "Savings" could not find a sweep to savings
 * however plainly the column said so.
 *
 * One resolver, three consumers: the cell, the sort, and now the search.
 */
describe('Account register — searching finds what the Category column says', () => {
  const search = async (term: string): Promise<void> => {
    fireEvent.click(screen.getByRole('button', { name: /Search & filters/ }));
    fireEvent.change(await screen.findByPlaceholderText(/Search by description/), {
      target: { value: term },
    });
  };

  it('matches the parent as well as the leaf, so "Bills" finds "Bills > Water"', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    await search('Bills');

    // Both water bills, and nothing else: the word is in the column on those
    // two rows and on no others.
    expect(columnInOrder('Description')).toEqual([
      'Aqua Utilities quarter one',
      'Aqua Utilities quarter two',
    ]);
    expect(columnInOrder('Category')).toEqual(['Bills > Water', 'Bills > Water']);
  });

  it('finds a transfer by the account its column names', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    await search('Synthetic Savings');

    // "Transfer > Synthetic Savings" is what these two rows say. A leaf lookup
    // could never match it — their stored category is the literal
    // 'transfer-out', which is no category's id.
    expect(columnInOrder('Description')).toEqual([
      'Sweep to savings',
      'Standing order to savings',
    ]);
  });

  it('still finds nothing when nothing matches', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    await search('Quenchless');

    // A wider search must not become a looser one: an uncategorised row's label
    // is the empty string, and the empty string must go on matching nothing
    // rather than everything.
    expect(columnInOrder('Description')).toEqual([]);
    // And says so as a FILTERED-empty, in both viewports: the rows are behind
    // the search, not missing (DESIGN_PASS §4). This used to read
    // 'No transactions found', which was the same words for both cases.
    expect(
      screen.getAllByRole('heading', { level: 3, name: 'No transactions match these filters' })
    ).toHaveLength(2);
    expect(screen.getAllByText('Search: Quenchless').length).toBeGreaterThan(0);
  });
});
