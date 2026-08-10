/**
 * The register's way back, when something other than the accounts list sent
 * the user here.
 *
 * The complaint: the duplicate sweep's "In the register" jump stranded people.
 * The dialog closed, the register opened, and the only way back was the browser
 * button — which returned to Data Management with the dialog gone and their
 * place in a three-hundred-row list lost. The register's own back button now
 * says where they came from and takes them there, carrying whatever that page
 * needs to put itself back together.
 *
 * A register reached the ordinary way is untouched: "Back to Accounts".
 *
 * Every name, date and figure below is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
];

const ROW: Transaction = {
  id: 'txn-one', date: new Date('2026-03-01'), description: 'Synthetic row',
  amount: -21.5, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
};

const SWEEP_CRUMBS = {
  tool: 'find-duplicates',
  windowDays: 7,
  accountFilter: '',
  sortKey: 'date',
  sortDir: -1,
  pairKey: 'txn-one|txn-two',
  reviewing: true,
};

/** Where the router ended up, and what it was handed. */
function Landing(): React.JSX.Element {
  const location = useLocation();
  return (
    <div>
      <h1>Data Management</h1>
      <span data-testid="handed-back">{JSON.stringify(location.state)}</span>
    </div>
  );
}

const renderRegister = (state?: unknown): void => {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/accounts/${ACCOUNT.id}`, state }]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
              <Route path="/accounts" element={<h1>Accounts</h1>} />
              <Route path="/settings/data" element={<Landing />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const openRegister = async (state?: unknown): Promise<void> => {
  renderRegister(state);
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
};

beforeEach(() => {
  localStorage.clear();
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: [ROW],
    categories: CATEGORIES,
    isLoading: false,
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  // Only this spy. `restoreAllMocks` would also strip the implementation off
  // the global matchMedia the shared setup installs, and the register's mobile
  // card list reads it on the very next render.
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('the register’s way back', () => {
  it('goes to the accounts list when that is where the user came from', async () => {
    await openRegister();

    fireEvent.click(screen.getByRole('button', { name: /Back to Accounts/ }));

    expect(screen.getByRole('heading', { level: 1, name: 'Accounts' })).toBeInTheDocument();
  });

  it('names the sweep that sent them, and returns to it', async () => {
    await openRegister({
      from: { path: '/settings/data', label: 'Back to Find duplicates', resume: SWEEP_CRUMBS },
    });

    expect(screen.queryByRole('button', { name: /Back to Accounts/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back to Find duplicates/ }));

    expect(screen.getByRole('heading', { level: 1, name: 'Data Management' })).toBeInTheDocument();
  });

  it('hands the sweep back what it needs to reopen where it was', async () => {
    await openRegister({
      from: { path: '/settings/data', label: 'Back to Find duplicates', resume: SWEEP_CRUMBS },
    });

    fireEvent.click(screen.getByRole('button', { name: /Back to Find duplicates/ }));

    expect(JSON.parse(screen.getByTestId('handed-back').textContent || 'null'))
      .toEqual({ resume: SWEEP_CRUMBS });
  });

  it('keeps the way back while it consumes a deep link to a row', async () => {
    // Landing on ?txn= replaces the history entry to take the parameter out of
    // the URL, and a replace starts with null state unless the state is carried
    // over by hand. That is exactly the jump the sweep makes.
    render(
      <MemoryRouter initialEntries={[{
        pathname: `/accounts/${ACCOUNT.id}`,
        search: '?txn=txn-one',
        state: { from: { path: '/settings/data', label: 'Back to Find duplicates', resume: SWEEP_CRUMBS } },
      }]}>
        <PreferencesProvider>
          <ToastProvider>
            <NotificationProvider>
              <Routes>
                <Route path="/accounts/:accountId" element={<AccountTransactions />} />
                <Route path="/settings/data" element={<Landing />} />
              </Routes>
            </NotificationProvider>
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Back to Find duplicates/ })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Back to Find duplicates/ }));
    expect(JSON.parse(screen.getByTestId('handed-back').textContent || 'null'))
      .toEqual({ resume: SWEEP_CRUMBS });
  });

  it('lands a notification’s deep link on the row itself, highlighted', async () => {
    // The far end of "a new-transaction notification takes you to the row":
    // the bell navigates to exactly this URL (see EnhancedNotificationBell),
    // and the register's own deep-link machinery does the rest — the row
    // arrives selected, with its own boxes open.
    render(
      <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}?txn=${ROW.id}`]}>
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
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    await waitFor(() =>
      expect(screen.getByLabelText('Transaction description')).toHaveValue(ROW.description)
    );
  });

  it('says nothing new when the state is from a build that wrote something else', async () => {
    // History entries outlive a deploy; an unreadable one falls back to the
    // register's own back button rather than drawing half a link.
    await openRegister({ from: { label: 'Back to somewhere' } });

    expect(screen.getByRole('button', { name: /Back to Accounts/ })).toBeInTheDocument();
  });
});
