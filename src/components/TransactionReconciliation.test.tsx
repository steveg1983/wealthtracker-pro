/**
 * TransactionReconciliation tests
 *
 * Focus: match scoring. Amounts are stored SIGNED (expenses negative), so
 * the 10% amount-similarity test must divide by the magnitude of the
 * uncleared amount. Dividing by the signed value made the ratio negative
 * for every expense, so wildly different amounts scored "+20 similar" and
 * could push fabricated 80-point auto-clears.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import TransactionReconciliation from './TransactionReconciliation';

const mockUseApp = vi.fn();
const mockUpdateTransaction = vi.fn();

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => mockUseApp()
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (value: number) => `£${value.toFixed(2)}`
  })
}));

vi.mock('./common/Modal', () => ({
  Modal: ({ children, isOpen, title }: { children?: React.ReactNode; isOpen: boolean; title: string }) =>
    isOpen ? (
      <div role="dialog">
        <div>{title}</div>
        {children}
      </div>
    ) : null
}));

vi.mock('./icons', () => ({
  CheckCircleIcon: () => <span data-testid="check-circle-icon" />,
  LinkIcon: () => <span data-testid="link-icon" />,
  RefreshCwIcon: () => <span data-testid="refresh-icon" />,
  CalendarIcon: () => <span data-testid="calendar-icon" />
}));

const ACCOUNT_ID = 'acc-1';

const accounts = [
  { id: ACCOUNT_ID, name: 'Test Account', type: 'current', balance: 900, currency: 'GBP' }
];

/** A date inside the default reconciliation window (last month → today). */
const unclearedDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d;
})();

/**
 * A cleared-history date before the window start, on a DIFFERENT day of
 * month than the uncleared transaction so the +10 recurring bonus never
 * contributes to the scores under test.
 */
const historicalDate = (() => {
  const d = new Date(unclearedDate);
  d.setMonth(d.getMonth() - 2);
  if (d.getDate() === unclearedDate.getDate()) {
    d.setDate(d.getDate() - 1);
  }
  return d;
})();

const renderModal = (transactions: Array<Record<string, unknown>>): void => {
  mockUseApp.mockReturnValue({
    transactions,
    accounts,
    updateTransaction: mockUpdateTransaction
  });

  render(
    <TransactionReconciliation isOpen={true} onClose={vi.fn()} accountId={ACCOUNT_ID} />
  );
};

describe('TransactionReconciliation amount-similarity scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not suggest a wildly different amount for a signed-negative uncleared expense', () => {
    // Uncleared expense of -£100. Historical candidates share the exact
    // description (+30 similarity points):
    //  - h-exact  (-£100):  exact amount (+40) → 70 ≥ 50 → suggested
    //  - h-bogus (-£5000): 4900% off — only ranks if the buggy signed
    //    denominator makes the ratio negative → must NOT be suggested
    renderModal([
      {
        id: 'u1',
        accountId: ACCOUNT_ID,
        date: unclearedDate,
        amount: -100,
        description: 'Monthly Rent',
        category: 'Housing',
        type: 'expense',
        cleared: false
      },
      {
        id: 'h-exact',
        accountId: ACCOUNT_ID,
        date: historicalDate,
        amount: -100,
        description: 'Monthly Rent',
        category: 'Other',
        type: 'expense',
        cleared: true
      },
      {
        id: 'h-bogus',
        accountId: ACCOUNT_ID,
        date: historicalDate,
        amount: -5000,
        description: 'Monthly Rent',
        category: 'Other',
        type: 'expense',
        cleared: true
      }
    ]);

    // The exact-amount candidate is suggested…
    expect(screen.getByText('Possible matches:')).toBeInTheDocument();
    expect(screen.getByText('Exact amount match', { exact: false })).toBeInTheDocument();
    // …but no candidate may earn 'similar amount' points: -5000 vs -100 is
    // 4900% off, which only passes a signed (negative) denominator.
    expect(screen.queryByText('Similar amount (within 10%)', { exact: false })).not.toBeInTheDocument();
  });

  it('gives no similar-amount points when the uncleared amount is zero', () => {
    // Zero uncleared amount: the percentage test is undefined, so only an
    // exact zero can earn amount points. The candidate still qualifies at
    // exactly 50 via description (+30) and category (+20) — but must not
    // carry any amount-based reason.
    renderModal([
      {
        id: 'u-zero',
        accountId: ACCOUNT_ID,
        date: unclearedDate,
        amount: 0,
        description: 'Pending Card Hold',
        category: 'Shopping',
        type: 'expense',
        cleared: false
      },
      {
        id: 'h-nonzero',
        accountId: ACCOUNT_ID,
        date: historicalDate,
        amount: -50,
        description: 'Pending Card Hold',
        category: 'Shopping',
        type: 'expense',
        cleared: true
      }
    ]);

    expect(screen.getByText('Possible matches:')).toBeInTheDocument();
    expect(screen.queryByText('Similar amount (within 10%)', { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText('Exact amount match', { exact: false })).not.toBeInTheDocument();
  });
});
