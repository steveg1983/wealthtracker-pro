import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import Categorisation from '../Categorisation';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { __resetHistoricalRatesForTests } from '../../services/historicalRatesService';
import type { Account, Category, Transaction } from '../../types';

/**
 * CATEGORISATION'S MONEY FIGURES CONVERT (Design's §5, 25 Aug).
 *
 * "Money in" and "Money out" describe the backlog — the money the reports
 * cannot see until it is filed. They summed NATIVE units as display units
 * until now, and said nothing about it: the last two undisclosed native sums
 * in the app, both recorded by the currency census as 'native-known'. Design
 * ruled convert rather than disclose ("disclosure was the honest interim,
 * never the goal"), so this pins the converted behaviour and its ≈.
 *
 * The rate served below is invented and the amounts are invented; this repo
 * is public. 2.0 is deliberately not a plausible USD rate — a wrong basis
 * has to be visible at a glance rather than arguable.
 */

vi.mock('@data', () => ({
  dataPort: {
    listClosedAccounts: vi.fn(async () => []),
  },
}));

const account = (id: string, currency: string): Account =>
  ({ id, name: id, type: 'current', balance: 0, currency, isActive: true,
     lastUpdated: new Date(2024, 0, 1) } as unknown as Account);

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
];

/** An UNCATEGORISED row — blank category is what puts it in the backlog. */
const unfiled = (id: string, accountId: string, amount: number): Transaction =>
  ({ id, date: new Date(2024, 5, 10), description: id, amount, accountId,
     category: '', type: amount >= 0 ? 'income' : 'expense' } as unknown as Transaction);

/** The ECB history the flows seam values each row's own date against. */
const historyResponds = (): void => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ rates: { '2024-06-10': { USD: 2 } }, base: 'GBP' }),
  }) as unknown as Response));
};

const providerDead = (): void => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
};

const renderPage = (): void => {
  render(
    <MemoryRouter>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Categorisation />
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

beforeEach(async () => {
  await __resetHistoricalRatesForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetAppContextValue();
});

describe('Categorisation — the backlog figures and their basis', () => {
  it('converts a foreign row and marks the figure ≈', async () => {
    historyResponds();
    __setAppContextValue({
      accounts: [account('gbp', 'GBP'), account('usd', 'USD')],
      transactions: [unfiled('t1', 'usd', 100)],
      transactionSplits: [],
      categories: CATEGORIES,
    });
    renderPage();

    // $100 at the served rate is £50 — never £100, which is the falsehood
    // this whole seam exists to stop.
    // The ECB history is the THIRD network call (today's rates, the ECB
    // overlay, then the range), so the ≈ arrives a tick after first paint.
    await screen.findByTestId('report-currency-basis', undefined, { timeout: 5000 });
    const moneyIn = screen.getByTestId('categorisation-money-in');
    expect(moneyIn).toHaveTextContent(/≈/);
    expect(moneyIn).toHaveTextContent(/50/);
    expect(moneyIn).not.toHaveTextContent(/100/);
  });

  it('states the basis it converted on, in the reports own words', async () => {
    historyResponds();
    __setAppContextValue({
      accounts: [account('gbp', 'GBP'), account('usd', 'USD')],
      transactions: [unfiled('t1', 'usd', 100)],
      transactionSplits: [],
      categories: CATEGORIES,
    });
    renderPage();

    // The same component the report hub mounts — so this page and a report
    // quoting the same backlog cannot claim different bases.
    expect(
      await screen.findByTestId('report-currency-basis', undefined, { timeout: 5000 })
    ).toHaveTextContent(/Converted at each day.s ECB reference rate/);
  });

  it('degrades to native WITH the disclosure, never to a third basis', async () => {
    providerDead();
    __setAppContextValue({
      accounts: [account('gbp', 'GBP'), account('usd', 'USD')],
      transactions: [unfiled('t1', 'usd', 100)],
      transactionSplits: [],
      categories: CATEGORIES,
    });
    renderPage();

    // No history → no conversion. The figure stays native and loses the ≈,
    // and the Phase 0 sentence is what says so.
    expect(await screen.findByTestId('mixed-currency-disclosure', undefined, { timeout: 5000 })).toBeInTheDocument();
    const moneyIn = screen.getByTestId('categorisation-money-in');
    expect(moneyIn).toHaveTextContent(/100/);
    expect(moneyIn).not.toHaveTextContent(/≈/);
  });

  it('says nothing about currency to a single-currency ledger', async () => {
    historyResponds();
    __setAppContextValue({
      accounts: [account('gbp', 'GBP')],
      transactions: [unfiled('t1', 'gbp', 100)],
      transactionSplits: [],
      categories: CATEGORIES,
    });
    renderPage();

    const moneyIn = await screen.findByTestId('categorisation-money-in');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(moneyIn).not.toHaveTextContent(/≈/);
    expect(screen.queryByTestId('report-currency-basis')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mixed-currency-disclosure')).not.toBeInTheDocument();
  });
});
