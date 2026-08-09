import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  configureStockPriceService,
  resetStockPriceService,
  fetchQuotes,
  searchSymbols,
  MAX_SYMBOLS_PER_REQUEST
} from './stockPriceService';

/**
 * The client half of the quote path.
 *
 * These specs exist because of what the previous implementation did: it fetched
 * Yahoo directly (blocked by CSP, and no CORS headers either), retried three
 * times, then returned `null` — and `getMultipleStockQuotes` dropped the failed
 * symbols from its Map entirely. The screen could not tell "still loading" from
 * "this will never work". So the behaviour pinned here is mostly about
 * FAILURES BEING VISIBLE.
 */

interface StubResponseInit {
  status?: number;
  body: unknown;
}

const jsonResponse = ({ status = 200, body }: StubResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const quoteEntry = (symbol: string, price: string, previousClose?: string) => ({
  symbol,
  price,
  currency: 'GBP',
  ...(previousClose === undefined ? {} : { previousClose }),
  name: `${symbol} plc`,
  asOf: '2026-08-08T16:35:00.000Z'
});

describe('fetchQuotes', () => {
  beforeEach(() => {
    resetStockPriceService();
  });

  it('posts the symbols to our own endpoint, not to Yahoo', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ body: { quotes: [quoteEntry('SHEL.L', '32.775', '32.6')] } })
    );
    configureStockPriceService({ fetch: fetchMock, getAuthToken: async () => 'tok' });

    await fetchQuotes(['SHEL.L']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    // 'self' is the only origin our CSP connect-src allows, and it is the only
    // origin that can actually reach Yahoo (server-side).
    expect(url).toBe('/api/quotes');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ symbols: ['SHEL.L'] });
  });

  it('sends the session token so the proxy is not an open market-data API', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ body: { quotes: [] } }));
    configureStockPriceService({ fetch: fetchMock, getAuthToken: async () => 'session-jwt' });

    await fetchQuotes(['AAPL']);

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer session-jwt');
  });

  it('keeps the price as a Decimal, so 32.775 does not become 32.78', async () => {
    configureStockPriceService({
      fetch: vi.fn(async () =>
        jsonResponse({ body: { quotes: [quoteEntry('SHEL.L', '32.775', '32.6')] } })
      ),
      getAuthToken: async () => 'tok'
    });

    const { quotes } = await fetchQuotes(['SHEL.L']);
    expect(quotes.get('SHEL.L')?.price.toString()).toBe('32.775');
  });

  it('derives the day move from the previous close', async () => {
    configureStockPriceService({
      fetch: vi.fn(async () =>
        jsonResponse({ body: { quotes: [quoteEntry('SHEL.L', '32.775', '32.6')] } })
      ),
      getAuthToken: async () => 'tok'
    });

    const quote = (await fetchQuotes(['SHEL.L'])).quotes.get('SHEL.L');
    expect(quote?.change?.toString()).toBe('0.175');
    expect(quote?.changePercent?.toFixed(4)).toBe('0.5368');
  });

  it('reports no move rather than +0.00 when there is no previous close', async () => {
    configureStockPriceService({
      fetch: vi.fn(async () => jsonResponse({ body: { quotes: [quoteEntry('FUND.L', '3.4271')] } })),
      getAuthToken: async () => 'tok'
    });

    const quote = (await fetchQuotes(['FUND.L'])).quotes.get('FUND.L');
    expect(quote?.previousClose).toBeNull();
    expect(quote?.change).toBeNull();
    expect(quote?.changePercent).toBeNull();
  });

  it('surfaces a per-symbol failure instead of omitting the symbol', async () => {
    configureStockPriceService({
      fetch: vi.fn(async () =>
        jsonResponse({
          body: {
            quotes: [
              quoteEntry('AAPL', '231.59', '229.35'),
              { symbol: 'NOTREAL', error: 'NOTREAL was not found' }
            ]
          }
        })
      ),
      getAuthToken: async () => 'tok'
    });

    const { quotes, errors } = await fetchQuotes(['AAPL', 'NOTREAL']);
    expect(quotes.has('AAPL')).toBe(true);
    expect(quotes.has('NOTREAL')).toBe(false);
    expect(errors.get('NOTREAL')).toBe('NOTREAL was not found');
  });

  it('marks every symbol in the batch when the endpoint itself fails', async () => {
    configureStockPriceService({
      fetch: vi.fn(async () =>
        jsonResponse({ status: 502, body: { error: 'Unable to fetch quotes', code: 'internal_error' } })
      ),
      getAuthToken: async () => 'tok'
    });

    const { quotes, errors } = await fetchQuotes(['AAPL', 'SHEL.L']);
    expect(quotes.size).toBe(0);
    expect(errors.get('AAPL')).toBe('Unable to fetch quotes');
    expect(errors.get('SHEL.L')).toBe('Unable to fetch quotes');
  });

  it('says to sign in again on a 401 rather than "not found"', async () => {
    configureStockPriceService({
      fetch: vi.fn(async () => new Response('nope', { status: 401 })),
      getAuthToken: async () => null
    });

    const { errors } = await fetchQuotes(['AAPL']);
    expect(errors.get('AAPL')).toBe('Sign in again to fetch prices');
  });

  it('turns a thrown network error into a per-symbol reason, never a null price', async () => {
    configureStockPriceService({
      fetch: vi.fn(async () => {
        throw new Error('Failed to fetch');
      }),
      getAuthToken: async () => 'tok'
    });

    const { quotes, errors } = await fetchQuotes(['AAPL']);
    expect(quotes.size).toBe(0);
    expect(errors.get('AAPL')).toBe('Could not reach the price service');
  });

  it('answers for a symbol the endpoint ignored, instead of leaving it blank forever', async () => {
    configureStockPriceService({
      fetch: vi.fn(async () =>
        jsonResponse({ body: { quotes: [quoteEntry('AAPL', '231.59', '229.35')] } })
      ),
      getAuthToken: async () => 'tok'
    });

    const { errors } = await fetchQuotes(['AAPL', 'GHOST']);
    expect(errors.get('GHOST')).toBe('No answer for GHOST');
  });

  it('deduplicates and upper-cases before asking', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ body: { quotes: [quoteEntry('AAPL', '231.59', '229.35')] } })
    );
    configureStockPriceService({ fetch: fetchMock, getAuthToken: async () => 'tok' });

    await fetchQuotes(['aapl', 'AAPL', ' aapl ']);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ symbols: ['AAPL'] });
  });

  it('splits a long list into successive requests rather than truncating it', async () => {
    const symbols = Array.from({ length: MAX_SYMBOLS_PER_REQUEST + 3 }, (_, i) => `SYM${i}`);
    const fetchMock = vi.fn(async () => jsonResponse({ body: { quotes: [] } }));
    configureStockPriceService({ fetch: fetchMock, getAuthToken: async () => 'tok' });

    const { errors } = await fetchQuotes(symbols);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Dropping the tail of a watchlist without saying so is the omission this
    // rewrite exists to remove: every symbol is accounted for.
    expect(errors.size).toBe(symbols.length);
  });

  it('serves a repeat request from cache instead of re-asking', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ body: { quotes: [quoteEntry('AAPL', '231.59', '229.35')] } })
    );
    let clock = 1_000;
    configureStockPriceService({
      fetch: fetchMock,
      getAuthToken: async () => 'tok',
      now: () => clock
    });

    await fetchQuotes(['AAPL']);
    clock += 30_000;
    const second = await fetchQuotes(['AAPL']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.quotes.get('AAPL')?.price.toString()).toBe('231.59');
  });

  it('re-asks once the cached quote is older than a minute', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ body: { quotes: [quoteEntry('AAPL', '231.59', '229.35')] } })
    );
    let clock = 1_000;
    configureStockPriceService({
      fetch: fetchMock,
      getAuthToken: async () => 'tok',
      now: () => clock
    });

    await fetchQuotes(['AAPL']);
    clock += 120_000;
    await fetchQuotes(['AAPL']);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks for nothing when given nothing', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ body: { quotes: [] } }));
    configureStockPriceService({ fetch: fetchMock, getAuthToken: async () => 'tok' });

    const { quotes, errors } = await fetchQuotes([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(quotes.size).toBe(0);
    expect(errors.size).toBe(0);
  });
});

describe('searchSymbols', () => {
  beforeEach(() => {
    resetStockPriceService();
  });

  it('queries our lookup endpoint and maps the rows', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        body: {
          matches: [
            { symbol: 'SHEL.L', name: 'Shell plc', exchange: 'LSE', type: 'Equity' },
            { symbol: 'SHEL', name: 'Shell plc', exchange: 'NYQ', type: 'Equity' }
          ]
        }
      })
    );
    configureStockPriceService({ fetch: fetchMock, getAuthToken: async () => 'tok' });

    const matches = await searchSymbols('shell');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/quotes-search?q=shell');
    expect(matches.map((m) => m.symbol)).toEqual(['SHEL.L', 'SHEL']);
    expect(matches[0].exchange).toBe('LSE');
  });

  it('throws when the lookup is unavailable instead of reporting "nothing matched"', async () => {
    // Telling someone their real ticker does not exist, because our search was
    // down, is the worse of the two possible mistakes.
    configureStockPriceService({
      fetch: vi.fn(async () =>
        jsonResponse({ status: 502, body: { error: 'Symbol lookup is unavailable' } })
      ),
      getAuthToken: async () => 'tok'
    });

    await expect(searchSymbols('shell')).rejects.toThrow('Symbol lookup is unavailable');
  });

  it('does not call the endpoint for an empty query', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ body: { matches: [] } }));
    configureStockPriceService({ fetch: fetchMock, getAuthToken: async () => 'tok' });

    expect(await searchSymbols('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
