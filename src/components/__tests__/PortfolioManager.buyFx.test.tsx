import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import PortfolioManager, { type PurchaseDetails } from '../PortfolioManager';
import type { Account } from '../../types';

/**
 * A BUY ACROSS A CURRENCY BOUNDARY.
 *
 * Owner, 18 Aug: "a currency conversion rate box that defaults to the most up
 * to date figure we have in the system but if the user got a different rate
 * (which they likely did), they can input their own rate for this transaction
 * and we just convert in to the GBP boxes."
 *
 * The rules these pin:
 *
 *  - the rate box appears only when the instrument and the money paying for it
 *    count in different currencies;
 *  - the system's rate fills it, and a typed rate replaces it;
 *  - the total paid follows the rate, and stays editable — the contract note
 *    wins over any arithmetic done here;
 *  - the rate is CARRIED with the purchase, with provenance: 'api' only for a
 *    live quote accepted untouched, 'manual' the moment the owner types.
 *
 * Every symbol, account and figure invented — this repo is public.
 */

const QUOTED_RATE = 0.8;

vi.mock('../../hooks/useFxQuote', () => ({
  useFxQuote: (from: string | null, to: string | null) =>
    from && to && from !== to
      ? {
          status: 'ready',
          rate: { toString: () => String(QUOTED_RATE) },
          source: 'api',
          asOf: new Date('2026-08-18T09:00:00Z'),
          provider: 'Sample Rates',
        }
      : { status: 'unavailable' },
}));

// The symbol picker reaches the network for a quote; here it just reports the
// instrument's own currency, which is the fact the conversion turns on.
vi.mock('../StockSymbolSearch', () => ({
  default: ({ onSelect }: {
    onSelect: (symbol: string, match: { name: string; type: string; exchange: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelect('SYNTH', { name: 'Synthetic Corp', type: 'equity', exchange: 'NASDAQ' })}
    >
      pick a synthetic instrument
    </button>
  ),
}));

vi.mock('../../services/stockPriceService', () => ({
  fetchQuotes: vi.fn(async () => ({
    quotes: new Map([['SYNTH', { symbol: 'SYNTH', price: 100, currency: 'USD' }]]),
    errors: new Map(),
  })),
}));

const FUNDING: Account = {
  id: 'acc-cash',
  name: 'Sterling Cash',
  type: 'current',
  currency: 'GBP',
  balance: 0,
  openingBalance: 0,
  lastUpdated: new Date(2026, 0, 1),
};

const onAdd = vi.fn(async () => {});

const renderManager = () =>
  render(
    <PreferencesProvider>
      <PortfolioManager
        holdings={[]}
        currency="GBP"
        fundingAccounts={[FUNDING]}
        onAdd={onAdd}
        onEdit={vi.fn(async () => {})}
        onDelete={vi.fn(async () => {})}
      />
    </PreferencesProvider>
  );

/** Open the add form and fill in a 10-unit buy of a dollar-priced instrument. */
const fillDollarBuy = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: /Add Your First Holding/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'pick a synthetic instrument' }));
  // The quote resolves and sets the instrument's currency to USD.
  await waitFor(() => {
    expect(screen.getByLabelText('Priced in')).toHaveValue('USD');
  });
  fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Average cost per unit'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Paid from'), { target: { value: FUNDING.id } });
};

const purchaseOf = (): PurchaseDetails => {
  const call = onAdd.mock.calls[0] as unknown as [unknown, PurchaseDetails] | undefined;
  if (!call) throw new Error('nothing was added');
  return call[1];
};

beforeEach(() => {
  onAdd.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PortfolioManager — a buy across a currency boundary', () => {
  it('offers the system rate, and converts the total into the account’s money', async () => {
    renderManager();
    await fillDollarBuy();

    const rateBox = await screen.findByLabelText('Rate: 1 USD in GBP');
    expect(rateBox).toHaveValue(String(QUOTED_RATE));
    expect(screen.getByText(/Sample Rates/)).toBeInTheDocument();

    // 10 × $100 = $1,000, at 0.8 → £800 in the box that pays.
    await waitFor(() => {
      expect(screen.getByLabelText('Total paid (GBP)')).toHaveValue('800.00');
    });
  });

  it('a typed rate replaces the quote, moves the total, and is recorded as the owner’s', async () => {
    renderManager();
    await fillDollarBuy();

    const rateBox = await screen.findByLabelText('Rate: 1 USD in GBP');
    // The broker's rate, which includes a spread the mid-market quote does not.
    fireEvent.change(rateBox, { target: { value: '0.75' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Total paid (GBP)')).toHaveValue('750.00');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());

    const purchase = purchaseOf();
    expect(purchase.fx).not.toBeNull();
    expect(purchase.fx?.rate.toString()).toBe('0.75');
    expect(purchase.fx?.from).toBe('USD');
    expect(purchase.fx?.to).toBe('GBP');
    // Typed, therefore theirs — never stamped with the provider's name.
    expect(purchase.fx?.source).toBe('manual');
    expect(purchase.totalPaid?.toString()).toBe('750');
  });

  it('an untouched live quote is recorded as the provider’s figure', async () => {
    renderManager();
    await fillDollarBuy();
    await screen.findByLabelText('Rate: 1 USD in GBP');

    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());

    expect(purchaseOf().fx?.source).toBe('api');
  });

  it('the total stays editable — the contract note wins over the arithmetic', async () => {
    renderManager();
    await fillDollarBuy();
    await screen.findByLabelText('Rate: 1 USD in GBP');

    const total = screen.getByLabelText('Total paid (GBP)');
    await waitFor(() => expect(total).toHaveValue('800.00'));

    // What actually left the account, per the broker.
    fireEvent.change(total, { target: { value: '803.15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());

    expect(purchaseOf().totalPaid?.toString()).toBe('803.15');
    // The rate is still carried: it is how the figure was reached, and a
    // register that kept only the sterling could not say which rate happened.
    expect(purchaseOf().fx?.rate.toString()).toBe(String(QUOTED_RATE));
  });

  it('shows no rate box at all when the instrument counts in the account’s own currency', async () => {
    renderManager();

    fireEvent.click(screen.getByRole('button', { name: /Add Your First Holding/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'pick a synthetic instrument' }));
    await waitFor(() => expect(screen.getByLabelText('Priced in')).toHaveValue('USD'));
    // Put the instrument back into sterling: nothing to convert.
    fireEvent.change(screen.getByLabelText('Priced in'), { target: { value: 'GBP' } });
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Average cost per unit'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Paid from'), { target: { value: FUNDING.id } });

    expect(screen.queryByLabelText(/^Rate: /)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Total paid (GBP)')).toHaveValue('1,000.00');
    });
  });
});
