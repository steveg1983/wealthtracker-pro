import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { preferences } from '../../services/preferencesService';
import ReportsHub from '../ReportsHub';
import { readReportPeriodDefault } from '../../utils/reportPeriodDefaults';
import type { Account, Category, Transaction } from '../../types';

/**
 * THE PERIOD CONTROL LIVES WHERE ITS EFFECT IS VISIBLE, AND A REPORT CAN
 * REMEMBER ITS OWN WINDOW (owner, 25 Aug).
 *
 * "On the report last page, we have the length of time options which on the
 * front report page doesn't change anything." It did set the window the next
 * report would open on — but nothing on the gallery moves when you press it,
 * so it read as broken.
 *
 * And his design for the replacement: the picker lives on each report, with a
 * save-as-default control, and "if they change the length, the button unticks
 * itself and the user has to press it again to update the default".
 *
 * Every account, category and figure below is invented: this repo is public.
 */

const LOADS_LAZY_REPORT = { timeout: 15_000 } as const;

const ACCOUNT: Account = {
  id: 'acc-p', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
];

const TRANSACTIONS: Transaction[] = [{
  id: 'txn-p', date: new Date('2024-08-15'), description: 'Synthetic shop',
  amount: -50, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
}];

const PERIOD_KEYS = [
  'reportsPeriod', 'reportsPeriodExplicit', 'reportsPeriodCustomStart', 'reportsPeriodCustomEnd',
  'reportDefaultPeriod:account-balances', 'reportDefaultPeriodCustom:account-balances',
  'reportDefaultPeriod:net-worth-over-time', 'reportDefaultPeriodCustom:net-worth-over-time',
];

const renderHub = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <PreferencesProvider>
        <ToastProvider>
          <Routes>
            <Route path="/reports" element={<ReportsHub />} />
            <Route path="/reports/:reportId" element={<ReportsHub />} />
          </Routes>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  for (const key of PERIOD_KEYS) preferences.removeItem(key);
  __setAppContextValue({
    accounts: [ACCOUNT], transactions: TRANSACTIONS, categories: CATEGORIES, transactionSplits: [],
  });
});

afterEach(() => {
  __resetAppContextValue();
});

describe('the period control appears only where its effect is visible', () => {
  it('the gallery has no period bar', () => {
    renderHub('/reports');
    // The gallery is a chooser. A window control here changed something the
    // page was not showing, which is the complaint.
    expect(document.querySelector('[data-period-bar]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Last month' })).toBeNull();
  });

  it('the gallery does not promise a control it no longer has', () => {
    renderHub('/reports');
    expect(screen.queryByText(/period you pick follows you/i)).toBeNull();
  });

  it('a report has one', async () => {
    renderHub('/reports/account-balances');
    await waitFor(() => {
      expect(document.querySelector('[data-period-bar]')).not.toBeNull();
    }, LOADS_LAZY_REPORT);
  });
});

describe('a report remembers its own window', () => {
  const saveControl = () => screen.getByRole('button', { name: /^Always open on/ });

  it('saves what is on screen, and says so', async () => {
    renderHub('/reports/account-balances');
    await waitFor(() => saveControl(), LOADS_LAZY_REPORT);

    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    fireEvent.click(saveControl());

    expect(readReportPeriodDefault('account-balances')?.period).toBe('last-month');
    expect(screen.getByText(/Opens on last month/)).toBeInTheDocument();
  });

  it('unticks itself when the window changes — the owner’s rule, derived not stored', async () => {
    renderHub('/reports/account-balances');
    await waitFor(() => saveControl(), LOADS_LAZY_REPORT);

    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    fireEvent.click(saveControl());
    expect(screen.getByText(/Opens on last month/)).toBeInTheDocument();

    // Look at a different window. The saved default is untouched; the control
    // stops claiming this one is it, and offers to make it so.
    fireEvent.click(screen.getByRole('button', { name: 'Tax year' }));
    expect(screen.queryByText(/Opens on/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Always open on tax year/ })).toBeInTheDocument();
    expect(readReportPeriodDefault('account-balances')?.period).toBe('last-month');
  });

  it('clearing puts the report back on the shared period', async () => {
    renderHub('/reports/account-balances');
    await waitFor(() => saveControl(), LOADS_LAZY_REPORT);

    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    fireEvent.click(saveControl());
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(readReportPeriodDefault('account-balances')).toBeNull();
    expect(screen.getByRole('button', { name: /^Always open on/ })).toBeInTheDocument();
  });

  it('opens on the saved window even after the user picked another one elsewhere', async () => {
    renderHub('/reports/account-balances');
    await waitFor(() => saveControl(), LOADS_LAZY_REPORT);
    fireEvent.click(screen.getByRole('button', { name: 'Tax year' }));
    fireEvent.click(saveControl());

    // A choice made elsewhere is stored in the SHARED period. The saved
    // default has to outrank it, or "always open on" is not true — which is
    // why this uses the arrival path rather than the surface-default one.
    preferences.setItem('reportsPeriod', 'this-month');
    preferences.setItem('reportsPeriodExplicit', 'true');

    const again = renderHub('/reports/account-balances');
    await waitFor(() => {
      expect(within(again.container).queryByText(/Opens on tax year/)).not.toBeNull();
    }, LOADS_LAZY_REPORT);
  });
});

describe('every report gets the control, including the one that draws its own bar', () => {
  /**
   * `net-worth-over-time` is the single report with `ownsPeriodBar` — its
   * picker lives inside the chart card (Design, 22 Aug), so the hub does not
   * render one above it. The first cut of this feature put the save control
   * in the hub's block only, which quietly left that report without it while
   * the owner had asked for "each report". The control follows the picker.
   */
  it('the net-worth report carries its own save-as-default control', async () => {
    renderHub('/reports/net-worth-over-time');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Always open on/ })).toBeInTheDocument();
    }, LOADS_LAZY_REPORT);

    // And it is the same control, backed by the same store.
    fireEvent.click(screen.getByRole('button', { name: /^Always open on/ }));
    expect(readReportPeriodDefault('net-worth-over-time')).not.toBeNull();
    expect(screen.getByText(/Opens on/)).toBeInTheDocument();
  });

  it('the hub does not ALSO draw one over it', async () => {
    // Two save controls on one page would be two answers to one question.
    renderHub('/reports/net-worth-over-time');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Always open on/ })).toBeInTheDocument();
    }, LOADS_LAZY_REPORT);
    expect(screen.getAllByRole('button', { name: /^Always open on/ })).toHaveLength(1);
  });
});
