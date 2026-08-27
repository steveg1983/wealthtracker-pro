import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { InvestmentEvent } from '../../services/investments/events';

// Every figure invented; the register maths is pinned in
// securityRegister.test.ts — these specs pin the WIRING: prices fetched for
// a symbol, none fetched for a symbol-less security (and the footer says
// why), realised shown on the sell line.

const { mockListPrices } = vi.hoisted(() => ({ mockListPrices: vi.fn() }));

vi.mock('@data', () => ({
  dataPort: { listInvestmentPrices: mockListPrices }
}));

const { default: SecurityHistoryModal } = await import('../SecurityHistoryModal');

const event = (over: Partial<InvestmentEvent> = {}): InvestmentEvent => ({
  id: 'e-1',
  accountId: 'acct-1',
  symbol: 'ABC.L',
  securityName: 'Alphabet Soup Holdings',
  date: '2013-01-10',
  kind: 'buy',
  quantity: '100',
  price: '10',
  fees: null,
  amount: '1000',
  currency: 'GBP',
  source: 'import',
  ...over
});

describe('SecurityHistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('draws the register from events and the fetched series, realised on the sell line', async () => {
    mockListPrices.mockResolvedValue([{ date: '2013-03-01', price: '12', source: 'import' }]);

    render(
      <SecurityHistoryModal
        symbol="ABC.L"
        securityName="Alphabet Soup Holdings"
        currency="GBP"
        events={[
          event(),
          event({ id: 'e-2', date: '2013-06-01', kind: 'sell', quantity: '100', price: '13', amount: '1300' })
        ]}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Buy')).toBeInTheDocument();
    expect(mockListPrices).toHaveBeenCalledWith('ABC.L');
    expect(screen.getByText('Revaluation — imported')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
    expect(screen.getByText('Realised £300.00')).toBeInTheDocument();
    expect(screen.getByText(/Bought £1,000\.00 · Sold £1,300\.00 · Realised £300\.00/)).toBeInTheDocument();
  });

  it('asks for no prices for a symbol-less security, and the footer says why', async () => {
    render(
      <SecurityHistoryModal
        symbol={null}
        securityName="Nameless Industries"
        currency="GBP"
        events={[event({ symbol: null, securityName: 'Nameless Industries' })]}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Buy')).toBeInTheDocument();
    expect(mockListPrices).not.toHaveBeenCalled();
    expect(
      screen.getByText(/no ticker symbol, so there is no price history/)
    ).toBeInTheDocument();
  });

  it('keeps the trades standing when the price read fails, and says so', async () => {
    mockListPrices.mockRejectedValue(new Error('The price history could not be read.'));

    render(
      <SecurityHistoryModal
        symbol="ABC.L"
        securityName="Alphabet Soup Holdings"
        currency="GBP"
        events={[event()]}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/trades below still stand/i);
    expect(screen.getByText('Buy')).toBeInTheDocument();
  });
});
