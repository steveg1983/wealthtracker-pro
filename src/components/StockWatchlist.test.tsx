import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { toDecimal } from '../utils/decimal';
import type { QuoteBatch, StockQuote } from '../services/stockPriceService';

/**
 * The watchlist's job is to be honest about what it knows.
 *
 * Before this rewrite it could not be: every quote failed (the browser cannot
 * reach Yahoo), failures were swallowed, and `lastUpdated` was stamped whether
 * or not anything arrived. A card therefore said "Loading…" forever while the
 * header claimed a fresh update. These specs pin the three fixes.
 */

const fetchQuotesMock = vi.fn<(symbols: readonly string[]) => Promise<QuoteBatch>>();

vi.mock('../services/stockPriceService', () => ({
  fetchQuotes: (symbols: readonly string[]) => fetchQuotesMock(symbols)
}));

// The symbol picker owns its own network calls; this spec is about the cards.
vi.mock('./StockSymbolSearch', () => ({
  default: () => <div data-testid="symbol-search" />
}));

const { default: StockWatchlist } = await import('./StockWatchlist');

const quote = (symbol: string, price: string, previousClose: string | null): StockQuote => {
  const priceDecimal = toDecimal(price);
  const previous = previousClose === null ? null : toDecimal(previousClose);
  return {
    symbol,
    price: priceDecimal,
    currency: 'GBP',
    previousClose: previous,
    change: previous === null ? null : priceDecimal.minus(previous),
    changePercent:
      previous === null || previous.isZero()
        ? null
        : priceDecimal.minus(previous).dividedBy(previous).times(100),
    name: `${symbol} plc`,
    asOf: new Date('2026-08-08T16:35:00.000Z')
  };
};

const batch = (
  quotes: StockQuote[],
  errors: Array<[string, string]> = []
): QuoteBatch => ({
  quotes: new Map(quotes.map((q) => [q.symbol, q])),
  errors: new Map(errors)
});

beforeEach(() => {
  fetchQuotesMock.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem('stock-watchlist', JSON.stringify(['SHEL.L', 'NOTREAL']));
});

describe('a symbol that could not be fetched', () => {
  it('names the symbol and the reason instead of spinning forever', async () => {
    fetchQuotesMock.mockResolvedValue(
      batch([quote('SHEL.L', '32.775', '32.6')], [['NOTREAL', 'NOTREAL was not found']])
    );

    render(<StockWatchlist />);

    await waitFor(() => {
      expect(
        // The server's message VERBATIM. It already writes a whole sentence —
        // "NOTREAL was not found", or "Couldn't fetch AAPL — upstream returned
        // 429" — and the card used to print "Couldn't fetch NOTREAL — " in
        // front of it, which read the symbol and the apology twice on the
        // second shape. The card's heading already names the symbol.
        screen.getByText(/NOTREAL was not found\. Try Refresh\./)
      ).toBeInTheDocument();
    });
    // …and the card that DID arrive is unaffected by its neighbour's failure.
    expect(screen.getByText('SHEL.L')).toBeInTheDocument();
  });

  it('keeps the failed card out of the loading state', async () => {
    fetchQuotesMock.mockResolvedValue(
      batch([quote('SHEL.L', '32.775', '32.6')], [['NOTREAL', 'NOTREAL was not found']])
    );

    render(<StockWatchlist />);

    await waitFor(() => {
      expect(screen.getByText(/NOTREAL was not found/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });
});

describe('the "Last updated" claim', () => {
  it('is not made when nothing arrived', async () => {
    fetchQuotesMock.mockResolvedValue(
      batch([], [
        ['SHEL.L', 'Could not reach the price service'],
        ['NOTREAL', 'Could not reach the price service']
      ])
    );

    render(<StockWatchlist />);

    await waitFor(() => {
      expect(screen.getByText('Not updated yet')).toBeInTheDocument();
    });
    // The old code stamped this unconditionally, so the header advertised a
    // fresh update at the exact moment nothing had been updated.
    expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument();
  });

  it('is made once at least one quote arrived', async () => {
    fetchQuotesMock.mockResolvedValue(
      batch([quote('SHEL.L', '32.775', '32.6')], [['NOTREAL', 'not found']])
    );

    render(<StockWatchlist />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });
});

describe('the cards themselves', () => {
  it('shows a day move only when there is a previous close to compare', async () => {
    window.localStorage.setItem('stock-watchlist', JSON.stringify(['SHEL.L', 'FUND.L']));
    fetchQuotesMock.mockResolvedValue(
      batch([quote('SHEL.L', '32.775', '32.6'), quote('FUND.L', '3.4271', null)])
    );

    render(<StockWatchlist />);

    await waitFor(() => {
      expect(screen.getByText('No previous close to compare')).toBeInTheDocument();
    });
    // A confident "+0.00 (0.00%)" would be a measurement nobody took.
    expect(screen.getByText(/\+£0\.18/)).toBeInTheDocument();
  });

  it('refetches when Refresh is pressed', async () => {
    fetchQuotesMock.mockResolvedValue(batch([quote('SHEL.L', '32.775', '32.6')]));
    const user = userEvent.setup();

    render(<StockWatchlist />);
    await waitFor(() => expect(fetchQuotesMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    // Pressing a button, not a 60-second timer: daily closes are the product.
    await waitFor(() => expect(fetchQuotesMock).toHaveBeenCalledTimes(2));
  });

  it('registers no polling timer at all', async () => {
    // The old component re-fetched every 60 seconds, forever, failing silently
    // each time. Prices are daily closes; a person presses Refresh.
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    fetchQuotesMock.mockResolvedValue(batch([quote('SHEL.L', '32.775', '32.6')]));

    render(<StockWatchlist />);
    await waitFor(() => expect(fetchQuotesMock).toHaveBeenCalledTimes(1));

    // Ignore the 50ms heartbeat testing-library's waitFor registers; anything
    // that re-fetches prices would be on the order of seconds or minutes.
    const pollingIntervals = setInterval.mock.calls
      .map(([, delay]) => (typeof delay === 'number' ? delay : 0))
      .filter((delay) => delay >= 1000);
    expect(pollingIntervals).toEqual([]);
    setInterval.mockRestore();
  });
});
