import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * What the register does with an account id it cannot find in the open list.
 *
 * The app context carries only OPEN accounts, so every jump into a CLOSED
 * account's register — the payee drill, a report drill, a transfer's other
 * side, a bookmark — used to land on a bare "Account not found". Closing an
 * account keeps every transaction, so that page was simply wrong. There are
 * three states now: open (the register), closed (an honest page offering the
 * re-open, the Accounts-page rule), and genuinely gone.
 *
 * Closed accounts load from DataService.getClosedAccounts — not the context —
 * so they are injected by spying on that call. Every figure and name here is
 * synthetic (this repo is public).
 */

const OPEN_ACCOUNT: Account = {
  id: 'acc-open', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CLOSED_ACCOUNT: Account = {
  id: 'acc-closed', name: 'Retired Savings', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: false,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const OPEN_ROW: Transaction = {
  id: 'txn-open', date: new Date('2026-02-02'), description: 'Synthetic open row',
  amount: -12.5, type: 'expense', category: 'det-groceries', accountId: 'acc-open', cleared: false,
};

const CLOSED_ROW: Transaction = {
  id: 'txn-closed', date: new Date('2026-02-03'), description: 'Synthetic closed row',
  amount: -30, type: 'expense', category: 'det-groceries', accountId: 'acc-closed', cleared: false,
};

const updateAccount = vi.fn(async () => {});
const refreshCategories = vi.fn(async () => {});
// The reopen's re-pull, as the real context does it: the account leaves the
// closed list and joins the open one.
const refreshAccountsAndTransactions = vi.fn(async () => {
  __setAppContextValue({ accounts: [OPEN_ACCOUNT, { ...CLOSED_ACCOUNT, isActive: true }] });
});

const renderRegister = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <PreferencesProvider>
        {/* The reopen reports failures through the app's toasts, and a selected
            row's editor raises transaction notifications — the same provider
            stack the route sits in. */}
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

const reopenButton = (): HTMLElement => screen.getByRole('button', { name: 'Re-open and view' });

describe('Account register — open, closed, and gone', () => {
  beforeEach(() => {
    localStorage.clear();
    updateAccount.mockClear();
    refreshCategories.mockClear();
    refreshAccountsAndTransactions.mockClear();
    __setAppContextValue({
      accounts: [OPEN_ACCOUNT],
      transactions: [OPEN_ROW, CLOSED_ROW],
      categories: CATEGORIES,
      isLoading: false,
      updateAccount,
      refreshCategories,
      refreshAccountsAndTransactions,
    });
    vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([CLOSED_ACCOUNT]);
  });

  afterEach(() => {
    // Only the closed-accounts spy is restored. vi.restoreAllMocks() would
    // also strip the shared setup's window.matchMedia implementation, and the
    // register's row components read prefers-reduced-motion through it.
    vi.mocked(DataService.getClosedAccounts).mockRestore();
    __resetAppContextValue();
  });

  it('renders the register for an open account, without asking for the closed list', async () => {
    renderRegister('/accounts/acc-open');

    expect(await screen.findByRole('heading', { level: 1, name: 'Synthetic Current' })).toBeInTheDocument();
    // The row is on show (the phone list and the desktop table both render it).
    expect(screen.getAllByText('Synthetic open row').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Re-open and view' })).not.toBeInTheDocument();
    // An ordinary register costs no extra request: the lookup only fires on a miss.
    expect(DataService.getClosedAccounts).not.toHaveBeenCalled();
  });

  it('meets a closed account with its name and the re-open offer, not its transactions', async () => {
    renderRegister('/accounts/acc-closed');

    // Named, so the user knows which account they have landed on…
    expect(await screen.findByRole('heading', { level: 1, name: 'Retired Savings' })).toBeInTheDocument();
    // …and told what is true: closed, no register, history intact.
    expect(screen.getByText(/closed accounts don’t have an open register/i)).toBeInTheDocument();
    expect(screen.getByText(/every transaction is preserved either way/i)).toBeInTheDocument();
    expect(reopenButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Accounts' })).toBeInTheDocument();

    // The register itself stays shut — closed accounts are not browsable.
    expect(screen.queryByText('Synthetic closed row')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Search & filters/ })).not.toBeInTheDocument();
    // Never the old dead end.
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
  });

  it('says an account is gone only when it is in neither list', async () => {
    vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([]);
    renderRegister('/accounts/acc-vanished');

    expect(await screen.findByText('This account no longer exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Accounts' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-open and view' })).not.toBeInTheDocument();
  });

  it('waits for the closed list rather than flashing an error at an account that exists', async () => {
    let release: (accounts: Account[]) => void = () => {};
    vi.spyOn(DataService, 'getClosedAccounts').mockReturnValue(
      new Promise<Account[]>(resolve => { release = resolve; })
    );

    renderRegister('/accounts/acc-closed');

    // In flight: no verdict either way.
    expect(await screen.findByText('Loading account…')).toBeInTheDocument();
    expect(screen.queryByText('This account no longer exists')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-open and view' })).not.toBeInTheDocument();

    release([CLOSED_ACCOUNT]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Retired Savings' })).toBeInTheDocument();
    expect(screen.queryByText('Loading account…')).not.toBeInTheDocument();
  });

  it('waits while the open list is still arriving', async () => {
    __setAppContextValue({ accounts: [], isLoading: true });
    renderRegister('/accounts/acc-open');

    expect(await screen.findByText('Loading account…')).toBeInTheDocument();
    // Nothing is decided yet, so nothing is asked of the server either.
    expect(DataService.getClosedAccounts).not.toHaveBeenCalled();
  });

  it('re-opens the account through the context, then renders its register in place', async () => {
    renderRegister('/accounts/acc-closed');
    fireEvent.click(await screen.findByRole('button', { name: 'Re-open and view' }));

    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith('acc-closed', { isActive: true });
    });
    // The Accounts page's recipe: re-pull the open list (closed accounts are
    // filtered out at load) and the categories (the DB trigger re-activated
    // the account's transfer category).
    await waitFor(() => {
      expect(refreshAccountsAndTransactions).toHaveBeenCalledTimes(1);
      expect(refreshCategories).toHaveBeenCalledTimes(1);
    });

    // The user stays put and the register takes over — no second navigation.
    expect(await screen.findByRole('button', { name: /Search & filters/ })).toBeInTheDocument();
    expect(screen.getAllByText('Synthetic closed row').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Re-open and view' })).not.toBeInTheDocument();
  });

  it('keeps the ?txn deep link across the re-open', async () => {
    renderRegister('/accounts/acc-closed?txn=txn-closed');

    const button = await screen.findByRole('button', { name: 'Re-open and view' });
    // mousedown as well as click: the register's click-outside-to-deselect
    // handler listens on mousedown, and pressing this very button used to be
    // "outside" — which would have thrown away the row the link asked for.
    fireEvent.mouseDown(button);
    fireEvent.click(button);

    // The deep-linked row arrives selected, docked in the quick-edit panel.
    const description = await screen.findByLabelText('Description');
    expect(description).toHaveValue('Synthetic closed row');
    expect(document.querySelector('[data-quick-edit-panel]')).not.toBeNull();
  });

  it('leaves the account closed when the re-open fails', async () => {
    updateAccount.mockRejectedValueOnce(new Error('network is down'));
    renderRegister('/accounts/acc-closed');

    fireEvent.click(await screen.findByRole('button', { name: 'Re-open and view' }));

    await waitFor(() => {
      expect(refreshAccountsAndTransactions).not.toHaveBeenCalled();
    });
    // Still the offer, not a half-open register — and the button is usable again.
    expect(reopenButton()).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Search & filters/ })).not.toBeInTheDocument();
  });
});
