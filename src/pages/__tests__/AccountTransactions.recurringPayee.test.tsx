/**
 * ARRIVING FROM A RECURRING PATTERN — the register narrowed to its payments.
 *
 * Owner, 18 Aug: clicking a payee on Plan → Recurring Payments sent him to
 * the bare account register — "pretty pointless". The link now carries
 * ?recurringPayee=<keys joined by |>, every label the pattern has worn, and
 * the register:
 *
 *  - shows ONLY that pattern's rows, matched by the DETECTOR's own payee
 *    normaliser (reference numbers collapse, so two raw wordings of one
 *    payee both match);
 *  - names the filter among the active filters, so a narrowed register can
 *    never read as the whole account;
 *  - consumes the parameter with a replace, like ?review= — the filter dies
 *    with the click that asked for it;
 *  - lets go from its own toolbar chip, and from Clear filters with the rest.
 *
 * Every name and figure invented — this repo is public.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import AccountTransactions from '../AccountTransactions';
import type { Account, Transaction } from '../../types';

const ACCOUNT: Account = {
  id: 'acc-register', name: 'Synthetic Register', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const base = {
  amount: -25,
  type: 'expense' as const,
  category: 'det-x',
  accountId: ACCOUNT.id,
  cleared: false,
};

/** The pattern, under its NEW label (a reference number varies per row). */
const NEW_LABEL_ROW: Transaction = {
  ...base, id: 'txn-a', description: 'ACME LTD PROPERTY 4021',
  date: new Date(Date.UTC(2026, 6, 3)),
};
/** …and under the label the bank used before the rename. */
const OLD_LABEL_ROW: Transaction = {
  ...base, id: 'txn-b', description: 'ACME 9944',
  date: new Date(Date.UTC(2026, 5, 3)),
};
/** A bystander at the same account, not part of the pattern. */
const OTHER_ROW: Transaction = {
  ...base, id: 'txn-c', description: 'Midtown Grocer',
  date: new Date(Date.UTC(2026, 6, 10)),
};

const renderAt = (url: string) => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: [NEW_LABEL_ROW, OLD_LABEL_ROW, OTHER_ROW],
    categories: [],
    isLoading: false,
    updateTransaction: vi.fn(async () => {}),
  });
  return render(
    <MemoryRouter initialEntries={[url]}>
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

const grid = (): HTMLElement =>
  screen.getByRole('grid', { name: 'Synthetic Register transactions' });

afterEach(() => {
  __resetAppContextValue();
});

describe('Account register — arriving from a recurring pattern', () => {
  it('shows only the pattern’s rows, across every label it has worn', async () => {
    // The keys are NORMALISED payee identities (the detector's own), so the
    // raw reference numbers on the rows must not defeat the match.
    const keys = encodeURIComponent('acme ltd property|acme');
    renderAt(`/accounts/${ACCOUNT.id}?recurringPayee=${keys}`);
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    expect(within(grid()).getByText('ACME LTD PROPERTY 4021')).toBeInTheDocument();
    expect(within(grid()).getByText('ACME 9944')).toBeInTheDocument();
    expect(within(grid()).queryByText('Midtown Grocer')).not.toBeInTheDocument();

    // Named, so a narrowed register can never read as the whole account.
    expect(screen.getByText(/Recurring payee: acme ltd property \(including former names\)/)).toBeInTheDocument();
  });

  it('the filter chip is the way out — one click restores the whole register', async () => {
    const keys = encodeURIComponent('acme ltd property|acme');
    renderAt(`/accounts/${ACCOUNT.id}?recurringPayee=${keys}`);
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
    expect(within(grid()).queryByText('Midtown Grocer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Recurring payee:/ }));

    expect(within(grid()).getByText('Midtown Grocer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Recurring payee:/ })).not.toBeInTheDocument();
  });

  it('without the parameter the register is untouched', async () => {
    renderAt(`/accounts/${ACCOUNT.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    expect(within(grid()).getByText('Midtown Grocer')).toBeInTheDocument();
    expect(screen.queryByText(/Recurring payee:/)).not.toBeInTheDocument();
  });
});
