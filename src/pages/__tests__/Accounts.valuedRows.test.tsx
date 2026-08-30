import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import Accounts from '../Accounts';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account, Transaction } from '../../types';

/**
 * A PAGE WHOSE ROWS ADD UP TO ITS OWN HEADLINE.
 *
 * The owner, 29 August 2026, reading the showcase ledger: "the net worth is
 * £1.726m and the account balances do not add up to anywhere near that … users
 * looking at this will think the figures are wrong." He was right, and the
 * gap was exactly the unrealised gain: the headline valued investments at
 * market, the rows stated their registers, and nothing on the page explained
 * the difference.
 *
 * What this file holds in place: an investment row states what the account is
 * WORTH, its band total agrees with its rows, the headline agrees with the
 * bands — and because the register's bottom line still matters to anyone
 * reconciling, the row names that too rather than hiding it.
 *
 * The valuation itself is mocked to a known delta: what is under test here is
 * the page's arithmetic, not the valuation engine (which has its own tests in
 * services/investments/investmentValuation.test.ts).
 *
 * Every figure invented: this repo is public.
 */

const GAIN = 40_000;

vi.mock('../../hooks/useInvestmentValuation', async () => {
  const { toDecimal } = await import('../../utils/decimal');
  return {
    useInvestmentValuation: () => ({
      // Only the ISA has holdings; every other account's worth is its ledger.
      deltaAt: (accountId: string) =>
        accountId === 'acc-isa' ? toDecimal(GAIN) : toDecimal(0),
      accountIds: new Set(['acc-isa']),
      unpricedPositions: 0,
      currencyMismatches: 0,
    }),
  };
});

const ACCOUNTS: Account[] = [
  {
    id: 'acc-current', name: 'Synthetic Current', type: 'current', balance: 5_000,
    currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 5_000,
    isActive: true, institution: 'Northgate Bank',
  },
  {
    id: 'acc-isa', name: 'Synthetic ISA', type: 'investment', balance: 100_000,
    currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100_000,
    isActive: true, institution: 'Fairhaven Invest',
  },
];

const renderAccounts = (): void => {
  __setAppContextValue({
    accounts: ACCOUNTS,
    transactions: [] as Transaction[],
    transactionSplits: [],
    budgets: [],
    categories: [],
    isLoading: false,
  });
  render(
    <MemoryRouter initialEntries={['/accounts']}>
      <PreferencesProvider>
        <ToastProvider>
          <Accounts />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

beforeEach(() => localStorage.clear());
afterEach(() => __resetAppContextValue());

describe('an investment row states what the account is worth', () => {
  it('shows market value on the row, not the money that was paid in', () => {
    renderAccounts();
    // £100,000 in the register + £40,000 unrealised = £140,000 of worth.
    expect(screen.getAllByText('£140,000.00').length).toBeGreaterThan(0);
  });

  it('still names the register figure, so it is findable for reconciling', () => {
    renderAccounts();
    // One combined line INSIDE the balance cell — a tenth cell wrapped the
    // nine-track grid and dropped the delete button to the next line
    // (owner, 30 Aug).
    expect(screen.getByText('£100,000.00 in the register')).toBeInTheDocument();
  });

  it('says nothing extra for an account with no holdings — nothing to explain', () => {
    renderAccounts();
    const current = screen.getByText('Synthetic Current').closest('div')!;
    expect(within(current).queryByText(/in the register/)).not.toBeInTheDocument();
  });

  it('the register line rides INSIDE the balance cell, never as a cell of its own', () => {
    renderAccounts();
    // AccountRowColumns is a fixed nine-track grid, and a surplus cell wraps
    // it — the owner watched the delete button fall to the next line while
    // every column slid one place right. jsdom computes no grid, so the pin
    // is the structure that prevents it: the register line and the worth
    // figure share one cell.
    const registerLine = screen.getByText('£100,000.00 in the register');
    const cell = registerLine.parentElement!;
    expect(within(cell).getByText('£140,000.00')).toBeInTheDocument();
  });
});

describe('the totals reconcile with what is on screen', () => {
  it('the headline equals the rows: £5,000 + £140,000', () => {
    renderAccounts();
    // The owner's test, made mechanical: add up what you can see, and the
    // net worth must be that.
    expect(screen.getAllByText('£145,000.00').length).toBeGreaterThan(0);
  });

  it('the band total for investments equals the row inside it', () => {
    renderAccounts();
    const band = screen.getByRole('button', { name: /INVESTMENTS/i });
    expect(within(band).getByText('£140,000.00')).toBeInTheDocument();
  });
});
