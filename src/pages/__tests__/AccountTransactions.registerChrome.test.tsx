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
import type { Account, Transaction } from '../../types';

/**
 * What the register LOOKS like — the four claims of DESIGN_PASS §3.1 and the
 * two empty states of §4, each pinned where it is actually visible.
 *
 * These are structural, not cosmetic. Every one of them is a claim about
 * meaning that a later "tidy-up" could quietly reverse:
 *
 *   · the C/R column has a baseline, so C and R read as CHANGE;
 *   · the table prints ONE currency, so the column can be added up;
 *   · Balance outweighs Payment/Deposit, so the line people track is findable;
 *   · a register emptied BY A FILTER says so, with the count and the filter,
 *     rather than looking like a register that lost its transactions.
 *
 * The account is deliberately in USD while the app's display currency is its
 * GBP default: that is the exact condition under which the old code printed a
 * £ total over $ rows, and a test in GBP would have passed throughout.
 *
 * Every name, date and figure here is invented: this repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-chrome', name: 'Synthetic Chrome', type: 'current', balance: 0,
  currency: 'USD', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const row = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'description'>): Transaction => ({
  amount: -10,
  type: 'expense',
  accountId: ACCOUNT.id,
  category: '',
  cleared: false,
  ...over,
});

const ROWS: Transaction[] = [
  row({ id: 'r-unmarked', date: new Date(Date.UTC(2024, 0, 9)), description: 'Halberd Ironmongers', amount: -40 }),
  // A mark made while balancing and NOT yet finalised. Both flags are stated
  // on purpose: reconciled left undefined falls back to `cleared`, which is
  // the register's existing three-valued rule (transactionReconciliation), and
  // would make this row an R.
  row({
    id: 'r-cleared', date: new Date(Date.UTC(2024, 0, 15)), description: 'Wexford Bakery',
    amount: -25, cleared: true, reconciled: false,
  }),
  row({
    id: 'r-reconciled', date: new Date(Date.UTC(2024, 0, 21)), description: 'Marlow Deposit',
    amount: 300, type: 'income', cleared: true, reconciled: true,
  }),
];

const renderRegister = (transactions: Transaction[] = ROWS): void => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions,
    categories: [],
    isLoading: false,
    getSubCategories: () => [],
    getDetailCategories: () => [],
  });
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

const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Chrome transactions' });

/**
 * The phone's card list. Both viewports are in the DOM at once and CSS picks
 * one, so every claim about what the register SAYS has to be addressed to a
 * viewport — an unscoped query would match twice and pass for the wrong reason.
 */
const phoneList = (): HTMLElement => screen.getByTestId('register-phone-list');

/** Which cell of a row holds the named column, read off the header itself. */
const columnIndex = (header: string): number => {
  const headers = Array.from(grid().querySelectorAll('[role="columnheader"]'));
  const index = headers.findIndex(cell => (cell.textContent ?? '').trim().startsWith(header));
  if (index === -1) throw new Error(`the register has no ${header} column`);
  return index;
};

const dataRows = (): HTMLElement[] =>
  Array.from(grid().querySelectorAll<HTMLElement>('[role="row"][id]'))
    .filter(el => !el.id.endsWith('-row-opening-balance'));

const cellOf = (description: string, column: string): HTMLElement => {
  const rowEl = dataRows().find(el => (el.textContent ?? '').includes(description));
  if (!rowEl) throw new Error(`no row for ${description}`);
  const cell = rowEl.querySelectorAll<HTMLElement>('[role="gridcell"]')[columnIndex(column)];
  if (!cell) throw new Error(`no ${column} cell on ${description}`);
  return cell;
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  __resetAppContextValue();
  // NOT restoreAllMocks: the shared setup file installs the window.matchMedia
  // every haptics-aware component reads, and restoring it takes that with it.
  vi.clearAllMocks();
});

describe('the register’s C/R column has a baseline', () => {
  it('gives an unmarked row a dimmed dot rather than an empty gutter', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    const unmarked = cellOf('Halberd Ironmongers', 'C/R');
    expect(unmarked).toHaveTextContent('·');
    // Not a letter, and not mistakable for one.
    expect(within(unmarked).queryByTitle('Reconciled')).not.toBeInTheDocument();
  });

  it('says nothing to a screen reader, which is told by the absence of C and R', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    const dot = cellOf('Halberd Ironmongers', 'C/R').querySelector('span');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });

  it('still marks C and R, which is what the dot exists to be a change FROM', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    expect(cellOf('Wexford Bakery', 'C/R')).toHaveTextContent('C');
    expect(cellOf('Wexford Bakery', 'C/R')).not.toHaveTextContent('·');
    expect(cellOf('Marlow Deposit', 'C/R')).toHaveTextContent('R');
    expect(cellOf('Marlow Deposit', 'C/R')).not.toHaveTextContent('·');
  });
});

describe('the register prints one currency', () => {
  it('gives the header total and every row the ACCOUNT’s currency, not the display default', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    // The account is USD; the app's display currency is the GBP default. Every
    // figure the register prints about this account must be in dollars, or the
    // Balance column is not a column of anything.
    const headerTotal = screen.getByText('Account Balance').parentElement;
    expect(headerTotal?.textContent).toContain('$');
    expect(headerTotal?.textContent).not.toContain('£');

    for (const description of ['Halberd Ironmongers', 'Wexford Bakery', 'Marlow Deposit']) {
      expect(cellOf(description, 'Balance').textContent).toContain('$');
      expect(cellOf(description, 'Balance').textContent).not.toContain('£');
    }
    expect(cellOf('Halberd Ironmongers', 'Payment').textContent).toContain('$');
    expect(cellOf('Marlow Deposit', 'Deposit').textContent).toContain('$');
  });
});

describe('the register’s weights say which column is the line', () => {
  it('carries the running Balance at 500 and Payment/Deposit at 400', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    const balance = cellOf('Halberd Ironmongers', 'Balance').querySelector('[data-testid="register-balance"]');
    expect(balance).toHaveClass('font-medium');

    // Colour still says direction; weight is what Balance has and these do not.
    expect(cellOf('Halberd Ironmongers', 'Payment').querySelector('span')).toHaveClass('font-normal');
    expect(cellOf('Marlow Deposit', 'Deposit').querySelector('span')).toHaveClass('font-normal');
  });

  it('draws no zebra: the hairline separates the rows, not a second background', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    for (const rowEl of dataRows()) {
      expect(rowEl.className).not.toContain('bg-gray-100');
    }
  });
});

describe('a register with nothing in it', () => {
  it('says what is absent, what follows from it, and offers both ways in', async () => {
    renderRegister([]);
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    expect(within(grid()).getByRole('heading', { level: 3, name: 'No transactions in this account yet' })).toBeInTheDocument();
    // The consequence, in the account's own currency.
    expect(within(grid()).getByText(/Its balance stays at \$100\.00/)).toBeInTheDocument();
    expect(within(grid()).getByText(/adds nothing to your reports/)).toBeInTheDocument();
    // Remedies as real controls, not directions to find one — and IN THE
    // TABLE, where the rows are missing, rather than only in the toolbar the
    // user has just failed to notice.
    expect(within(grid()).getByRole('button', { name: 'Add transaction' })).toBeInTheDocument();
    expect(within(grid()).getByRole('button', { name: 'Import a statement' })).toBeInTheDocument();
  });

  it('says the same thing on a phone, which used to be told to adjust filters it had not set', async () => {
    renderRegister([]);
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    const phone = within(phoneList());
    expect(phone.getByRole('heading', { level: 3, name: 'No transactions in this account yet' })).toBeInTheDocument();
    expect(phone.getByRole('button', { name: 'Add transaction' })).toBeInTheDocument();
    // The sentence the card list used to end on, gone: it was the advice for
    // the OTHER state, given to everybody.
    expect(phone.queryByText(/Try adjusting your filters/)).not.toBeInTheDocument();
  });
});

describe('a register the boot could not read is not an empty register', () => {
  // The seam's floor for a failed transaction read is an empty list beside a
  // working account list (loadBoot never rejects). Without this state the
  // register asserted "No transactions in this account yet" over a FULL
  // account every time one page of the boot download timed out — the same
  // "your money is gone" lie the filtered empty state exists to prevent,
  // told by the network instead of a filter.
  it('says the load failed and offers a retry, not a beginning', async () => {
    __setAppContextValue({ transactionsLoadFailed: true });
    renderRegister([]);
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    const scope = within(grid());
    expect(scope.getByRole('heading', { level: 3, name: "This account's transactions couldn't be loaded" })).toBeInTheDocument();
    // The consequence, then the reassurance: the rows exist, they were not read.
    expect(scope.getByText(/nothing is missing from your ledger/)).toBeInTheDocument();
    expect(scope.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    // The two claims this state must NOT make: a beginning, or its remedies.
    expect(scope.queryByRole('heading', { name: 'No transactions in this account yet' })).not.toBeInTheDocument();
    expect(scope.queryByRole('button', { name: 'Add transaction' })).not.toBeInTheDocument();
  });
});

describe('a register emptied by a filter is not an empty register', () => {
  const searchFor = (term: string): void => {
    fireEvent.click(screen.getByRole('button', { name: /Search & filters/ }));
    fireEvent.change(screen.getByPlaceholderText('Search by description, amount, category...'), {
      target: { value: term }
    });
  };

  it('names how many are hidden and which filter is hiding them', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    searchFor('Quenchless');

    const table = within(grid());
    expect(table.getByRole('heading', { level: 3, name: 'No transactions match these filters' })).toBeInTheDocument();
    // THE COUNT IS THE POINT: it is the sentence that says the rows still exist.
    expect(table.getByText('3')).toBeInTheDocument();
    expect(table.getByText('Search: Quenchless')).toBeInTheDocument();
  });

  it('is a DIFFERENT state from an empty register, in both viewports', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    searchFor('Quenchless');

    // The distinguishing words, either way round: the filtered state names the
    // count and the filter and offers to let go; the empty one names the
    // balance and offers the two ways in. Neither may wear the other's voice.
    for (const scope of [within(grid()), within(phoneList())]) {
      expect(scope.getByRole('heading', { level: 3, name: 'No transactions match these filters' })).toBeInTheDocument();
      expect(scope.getByText('Search: Quenchless')).toBeInTheDocument();
      expect(scope.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();

      expect(scope.queryByRole('heading', { name: 'No transactions in this account yet' })).not.toBeInTheDocument();
      expect(scope.queryByRole('button', { name: 'Add transaction' })).not.toBeInTheDocument();
      expect(scope.queryByText(/Its balance stays at/)).not.toBeInTheDocument();
    }
  });

  it('offers one control that gives them back, and it gives them back', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Chrome' });

    searchFor('Quenchless');
    expect(dataRows()).toHaveLength(0);

    fireEvent.click(within(grid()).getByRole('button', { name: 'Clear filters' }));

    expect(dataRows()).toHaveLength(3);
    expect(screen.queryByRole('heading', { name: 'No transactions match these filters' })).not.toBeInTheDocument();
  });
});
