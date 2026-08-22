import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MixedCurrencyDisclosure from './MixedCurrencyDisclosure';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Account } from '../types';

/**
 * Phase 0 of the currency programme (the disclosure ruling, 22 Aug §2):
 * a still-native total says it mixes currencies — and says NOTHING to the
 * single-currency majority, per the data-health rule.
 *
 * Every figure here is invented; the repo is public.
 */

const closedAccounts: Account[] = [];
vi.mock('@data', () => ({
  dataPort: {
    listClosedAccounts: vi.fn(async () => closedAccounts),
  },
}));

// The display currency alone — this component reads nothing else from it.
vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({ displayCurrency: 'GBP' }),
}));

const account = (id: string, currency: string): Account =>
  ({ id, name: id, type: 'current', balance: 100, currency, isActive: true } as unknown as Account);

afterEach(() => {
  __resetAppContextValue();
  closedAccounts.length = 0;
});

describe('MixedCurrencyDisclosure', () => {
  it('says the totals mix currencies when a foreign account exists', async () => {
    __setAppContextValue({ accounts: [account('gbp', 'GBP'), account('usd', 'USD')] });
    render(<MixedCurrencyDisclosure />);
    expect(await screen.findByTestId('mixed-currency-disclosure')).toHaveTextContent(
      /mix currencies.*not converted/
    );
  });

  it('says nothing to a single-currency ledger', () => {
    __setAppContextValue({ accounts: [account('gbp', 'GBP')] });
    const { container } = render(<MixedCurrencyDisclosure />);
    expect(container.querySelector('[data-testid="mixed-currency-disclosure"]')).toBeNull();
  });

  it('counts CLOSED foreign accounts — history lives there', async () => {
    __setAppContextValue({ accounts: [account('gbp', 'GBP')] });
    closedAccounts.push(account('old-usd', 'USD'));
    render(<MixedCurrencyDisclosure />);
    await waitFor(() =>
      expect(screen.getByTestId('mixed-currency-disclosure')).toBeInTheDocument()
    );
  });
});
