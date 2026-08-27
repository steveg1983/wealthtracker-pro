import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { InvestmentEvent } from '../../services/investments/events';

// Every figure invented. Pinned here: the grouping and the EMPTY STORY —
// this component owns the closed-card sentence because only it knows whether
// imported history exists, and a card must say "no holdings were recorded"
// rather than render a silence.

const { mockListEvents, mockListPrices } = vi.hoisted(() => ({
  mockListEvents: vi.fn(),
  mockListPrices: vi.fn()
}));

vi.mock('@data', () => ({
  dataPort: {
    listInvestmentEvents: mockListEvents,
    listInvestmentPrices: mockListPrices
  }
}));

const { default: PortfolioTradingHistory } = await import('../PortfolioTradingHistory');

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

describe('PortfolioTradingHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPrices.mockResolvedValue([]);
  });

  it('lists each traded security with its span and realised result', async () => {
    mockListEvents.mockResolvedValue([
      event(),
      event({ id: 'e-2', date: '2014-03-01', kind: 'sell', quantity: '100', price: '13', amount: '1300' }),
      event({ id: 'e-3', symbol: null, securityName: 'Nameless Industries', date: '2012-06-01' })
    ]);

    render(<PortfolioTradingHistory accountId="acct-1" hasHoldings={false} />);

    expect(await screen.findByText('Securities traded')).toBeInTheDocument();
    expect(screen.getByText('Alphabet Soup Holdings (ABC.L)')).toBeInTheDocument();
    expect(screen.getByText(/2013–2014 · 2 trades · Realised £300\.00/)).toBeInTheDocument();
    // A never-sold position says so instead of pretending it closed — and
    // realises nothing, so no "Realised £0.00" noise.
    expect(screen.getByText(/2012 · 1 trade · still held/)).toBeInTheDocument();
  });

  it('tells the no-history closed card its honest sentence', async () => {
    mockListEvents.mockResolvedValue([]);

    render(<PortfolioTradingHistory accountId="acct-1" hasHoldings={false} />);

    expect(
      await screen.findByText(/No holdings were recorded for this portfolio/)
    ).toBeInTheDocument();
  });

  it('renders nothing under a holdings card with no history — the everyday card is untouched', async () => {
    mockListEvents.mockResolvedValue([]);

    const { container } = render(<PortfolioTradingHistory accountId="acct-1" hasHoldings />);

    await waitFor(() => expect(mockListEvents).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the security register on click', async () => {
    mockListEvents.mockResolvedValue([
      event(),
      event({ id: 'e-2', date: '2014-03-01', kind: 'sell', quantity: '100', price: '13', amount: '1300' })
    ]);

    render(<PortfolioTradingHistory accountId="acct-1" hasHoldings={false} />);

    fireEvent.click(await screen.findByText('Alphabet Soup Holdings (ABC.L)'));

    expect(await screen.findByText('ABC.L — register')).toBeInTheDocument();
    expect(screen.getByText(/Bought £1,000\.00 · Sold £1,300\.00 · Realised £300\.00/)).toBeInTheDocument();
  });
});
