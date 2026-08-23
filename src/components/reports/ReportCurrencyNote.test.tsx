import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportCurrencyNote from './ReportCurrencyNote';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { __resetHistoricalRatesForTests } from '../../services/historicalRatesService';
import { preferences } from '../../services/preferencesService';
import type { Account, Transaction } from '../../types';

/**
 * The flows reports' one currency line (the disclosure ruling, 22 Aug §6.2
 * and §7 phase 1): the basis when the ECB history is in force, the Phase 0
 * disclosure while degraded, nothing for a single-currency ledger.
 *
 * Every figure here is invented; the repo is public.
 */

vi.mock('@data', () => ({
  dataPort: {
    listClosedAccounts: vi.fn(async () => []),
  },
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({ displayCurrency: 'GBP' }),
}));

const account = (id: string, currency: string): Account =>
  ({ id, name: id, type: 'current', balance: 100, currency, isActive: true } as unknown as Account);
const txn = (id: string, date: Date): Transaction =>
  ({ id, accountId: 'usd', amount: 10, date, description: id, type: 'income', category: '' } as unknown as Transaction);

const historyResponds = (): void => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ rates: { '2026-08-21': { USD: 1.3 } } }),
  }) as unknown as Response));
};

const providerDead = (): void => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
};

beforeEach(async () => {
  await __resetHistoricalRatesForTests();
  preferences.setItem('money_management_fx_flows_restatement_dismissed', '');
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetAppContextValue();
});

describe('ReportCurrencyNote', () => {
  it('states the daily basis — and the flows restatement, once — when the history is in force', async () => {
    historyResponds();
    __setAppContextValue({
      accounts: [account('gbp', 'GBP'), account('usd', 'USD')],
      transactions: [txn('t1', new Date(2026, 7, 20))],
    });
    render(<ReportCurrencyNote />);
    expect(await screen.findByTestId('report-currency-basis')).toHaveTextContent(
      /Converted at each day.s ECB reference rate/
    );
    // The window never reaches 1999 — the third clause is noise and absent.
    expect(screen.getByTestId('report-currency-basis')).not.toHaveTextContent(/1999/);
    expect(screen.getByText(/Report figures have been recalculated/)).toBeInTheDocument();
  });

  it('falls back to the Phase 0 disclosure while the history cannot be had', async () => {
    providerDead();
    __setAppContextValue({
      accounts: [account('gbp', 'GBP'), account('usd', 'USD')],
      transactions: [],
    });
    render(<ReportCurrencyNote />);
    expect(await screen.findByTestId('mixed-currency-disclosure')).toBeInTheDocument();
    expect(screen.queryByTestId('report-currency-basis')).not.toBeInTheDocument();
  });

  it('says nothing to a single-currency ledger', () => {
    historyResponds();
    __setAppContextValue({ accounts: [account('gbp', 'GBP')], transactions: [] });
    const { container } = render(<ReportCurrencyNote />);
    expect(container.querySelector('[data-testid]')).toBeNull();
  });
});
