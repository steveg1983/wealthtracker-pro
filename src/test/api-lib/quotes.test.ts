import { describe, expect, it, vi } from 'vitest';
// api/** is excluded from the vitest project (see vitest.config.ts), so the
// serverless helpers are exercised from here instead of going untested.
import {
  dedupeSymbols,
  fetchQuote,
  fetchQuotes,
  isQuoteFailure,
  MAX_SYMBOLS_PER_REQUEST,
  parseChartResponse,
  parseSymbolsPayload,
  searchSymbols,
  type FetchLike,
  type QuoteResult
} from '../../../api/_lib/quotes';
import {
  APPLE_NASDAQ_USD,
  SEARCH_SHELL,
  SHELL_LSE_GBP_PENCE,
  SYMBOL_NOT_FOUND,
  UK_OEIC_FUND_NO_MARKET_TIME,
  VANGUARD_LSE_GBP_POUNDS
} from './quotes.fixtures';

/** A fetch that answers from a symbol → [status, body] table. */
const stubFetch = (
  routes: Record<string, { status: number; body: unknown }>
): FetchLike =>
  vi.fn(async (input: string) => {
    const symbol = decodeURIComponent(input.split('/').pop() ?? '');
    const route = routes[symbol];
    if (!route) {
      return new Response('not stubbed', { status: 500 });
    }
    return new Response(JSON.stringify(route.body), {
      status: route.status,
      headers: { 'Content-Type': 'application/json' }
    });
  });

const expectSuccess = (result: QuoteResult) => {
  if (isQuoteFailure(result)) {
    throw new Error(`expected a quote, got failure: ${result.error}`);
  }
  return result;
};

describe('GBp → GBP normalisation (the 100x trap)', () => {
  it('divides an LSE share quoted in pence by exactly 100', () => {
    const quote = parseChartResponse('SHEL.L', SHELL_LSE_GBP_PENCE);

    // THE PIN. 3277.5 pence is £32.775 — not £3,277.50 (100x too big, the bug
    // this whole pipeline exists to prevent) and not £32.78 (rounded to the
    // penny, which loses half a penny per share).
    expect(quote.price).toBe('32.775');
    expect(quote.currency).toBe('GBP');
  });

  it('normalises previousClose in the same unit as price', () => {
    const quote = parseChartResponse('SHEL.L', SHELL_LSE_GBP_PENCE);
    expect(quote.previousClose).toBe('32.6');
  });

  it('leaves an ETF on the SAME exchange alone when it quotes in pounds', () => {
    // VUSA.L and SHEL.L share an exchange and a `.L` suffix. Only meta.currency
    // tells them apart, so a rule keyed off the ticker would divide this by 100.
    const quote = parseChartResponse('VUSA.L', VANGUARD_LSE_GBP_POUNDS);
    expect(quote.price).toBe('95.42');
    expect(quote.currency).toBe('GBP');
  });

  it('leaves a US ticker in USD untouched', () => {
    const quote = parseChartResponse('AAPL', APPLE_NASDAQ_USD);
    expect(quote.price).toBe('231.59');
    expect(quote.currency).toBe('USD');
  });

  it('keeps a fund price at full precision rather than rounding to the penny', () => {
    const quote = parseChartResponse('0P0000KSPA.L', UK_OEIC_FUND_NO_MARKET_TIME);
    expect(quote.price).toBe('3.4271');
  });
});

describe('quote metadata', () => {
  it('stamps asOf from the exchange time, not the time we asked', () => {
    const quote = parseChartResponse('AAPL', APPLE_NASDAQ_USD);
    expect(quote.asOf).toBe(new Date(1_754_683_200 * 1000).toISOString());
  });

  it('falls back to now when the instrument states no market time', () => {
    const before = Date.now();
    const quote = parseChartResponse('0P0000KSPA.L', UK_OEIC_FUND_NO_MARKET_TIME);
    expect(Date.parse(quote.asOf)).toBeGreaterThanOrEqual(before);
  });

  it('prefers the long name and echoes the canonical symbol', () => {
    const quote = parseChartResponse('shel.l', SHELL_LSE_GBP_PENCE);
    expect(quote.name).toBe('Shell plc');
    expect(quote.symbol).toBe('SHEL.L');
  });

  it('omits previousClose rather than inventing one', () => {
    const quote = parseChartResponse('0P0000KSPA.L', UK_OEIC_FUND_NO_MARKET_TIME);
    expect(quote.previousClose).toBeUndefined();
  });

  it('refuses a response with no price instead of returning zero', () => {
    expect(() =>
      parseChartResponse('X', { chart: { result: [{ meta: { currency: 'GBP' } }], error: null } })
    ).toThrow(/no price/i);
  });

  it('reports Yahoo’s own error description', () => {
    expect(() => parseChartResponse('NOPE', SYMBOL_NOT_FOUND)).toThrow(/delisted/i);
  });
});

describe('per-symbol failure surfacing', () => {
  it('names a symbol that 404s instead of dropping it', async () => {
    const result = await fetchQuote(
      'NOTREAL',
      stubFetch({ NOTREAL: { status: 404, body: SYMBOL_NOT_FOUND } })
    );
    expect(result).toEqual({ symbol: 'NOTREAL', error: 'NOTREAL was not found' });
  });

  it('returns one entry per requested symbol, good and bad alike', async () => {
    const results = await fetchQuotes(
      ['SHEL.L', 'NOTREAL', 'AAPL'],
      stubFetch({
        'SHEL.L': { status: 200, body: SHELL_LSE_GBP_PENCE },
        NOTREAL: { status: 404, body: SYMBOL_NOT_FOUND },
        AAPL: { status: 200, body: APPLE_NASDAQ_USD }
      })
    );

    // The old client silently omitted failures, so a watchlist card for a bad
    // ticker sat on "Loading…" forever. Three asked, three answered.
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.symbol)).toEqual(['SHEL.L', 'NOTREAL', 'AAPL']);
    expect(results.filter(isQuoteFailure)).toHaveLength(1);
    expect(expectSuccess(results[0]).price).toBe('32.775');
  });

  it('falls over to the second Yahoo host when the first 5xxs', async () => {
    let call = 0;
    const flaky: FetchLike = vi.fn(async () => {
      call += 1;
      return call === 1
        ? new Response('boom', { status: 503 })
        : new Response(JSON.stringify(APPLE_NASDAQ_USD), { status: 200 });
    });

    const result = await fetchQuote('AAPL', flaky);
    expect(expectSuccess(result).price).toBe('231.59');
    expect(call).toBe(2);
  });

  it('does not retry a 404 on the second host', async () => {
    const counting: FetchLike = vi.fn(
      async () => new Response(JSON.stringify(SYMBOL_NOT_FOUND), { status: 404 })
    );
    await fetchQuote('NOTREAL', counting);
    expect(counting).toHaveBeenCalledTimes(1);
  });

  it('reports a network failure as a failure, never as a null price', async () => {
    const dead: FetchLike = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const result = await fetchQuote('AAPL', dead);
    expect(isQuoteFailure(result)).toBe(true);
    expect(isQuoteFailure(result) && result.error).toContain('AAPL');
  });
});

describe('symbol list handling (what the cron and the proxy share)', () => {
  it('deduplicates and upper-cases, keeping first-seen order', () => {
    // The cron walks every user's rows: one popular fund is many rows and must
    // still be exactly one Yahoo request.
    expect(dedupeSymbols(['shel.l', 'AAPL', 'SHEL.L', 'aapl', 'VUSA.L'])).toEqual([
      'SHEL.L',
      'AAPL',
      'VUSA.L'
    ]);
  });

  it('drops entries that are not tickers rather than pasting them into a URL', () => {
    expect(dedupeSymbols(['AAPL', '', '  ', 'DROP TABLE users', '../../etc/passwd'])).toEqual([
      'AAPL'
    ]);
  });

  it('fetches a duplicated symbol once', async () => {
    const stub = stubFetch({ AAPL: { status: 200, body: APPLE_NASDAQ_USD } });
    const results = await fetchQuotes(['AAPL', 'aapl', 'AAPL'], stub);
    expect(results).toHaveLength(1);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('rejects a payload that is not an array', () => {
    expect(parseSymbolsPayload('AAPL')).toEqual({ error: expect.stringContaining('array') });
  });

  it('rejects an empty list', () => {
    expect(parseSymbolsPayload([])).toEqual({ error: expect.stringContaining('at least one') });
  });

  it('rejects a list longer than the batch ceiling', () => {
    const tooMany = Array.from({ length: MAX_SYMBOLS_PER_REQUEST + 1 }, (_, i) => `SYM${i}`);
    expect(parseSymbolsPayload(tooMany)).toEqual({
      error: expect.stringContaining(String(MAX_SYMBOLS_PER_REQUEST))
    });
  });

  it('rejects a list whose entries are all unusable', () => {
    expect(parseSymbolsPayload([1, 2, {}])).toEqual({
      error: expect.stringContaining('no usable tickers')
    });
  });

  it('accepts a mixed list, keeping only the tickers', () => {
    expect(parseSymbolsPayload(['SHEL.L', 42, 'AAPL'])).toEqual({
      symbols: ['SHEL.L', 'AAPL']
    });
  });
});

describe('the nightly cron’s symbol reduction', () => {
  /**
   * api/cron/quotes.ts reads `select('symbol')` across EVERY user's holdings and
   * reduces it with dedupeSymbols before fetching. This models that reduction on
   * a realistic result set: several users, the same popular fund, mixed case,
   * and a row whose symbol column is null.
   */
  const rowsToSymbols = (rows: Array<{ symbol: unknown }>): string[] =>
    dedupeSymbols(
      rows
        .map((row) => row.symbol)
        .filter((symbol): symbol is string => typeof symbol === 'string')
    );

  it('fetches a symbol once however many rows hold it', () => {
    const rows = [
      { symbol: 'VUSA.L' }, // user A
      { symbol: 'SHEL.L' }, // user A
      { symbol: 'vusa.l' }, // user B, typed in lower case
      { symbol: 'VUSA.L' }, // user C
      { symbol: 'AAPL' }
    ];

    // Five rows, three requests. Without this the cron's Yahoo traffic grows
    // with the number of USERS rather than the number of instruments.
    expect(rowsToSymbols(rows)).toEqual(['VUSA.L', 'SHEL.L', 'AAPL']);
  });

  it('skips rows with no symbol instead of fetching an empty ticker', () => {
    expect(rowsToSymbols([{ symbol: null }, { symbol: '' }, { symbol: 'AAPL' }])).toEqual([
      'AAPL'
    ]);
  });

  it('leaves the batch small enough to chunk evenly', async () => {
    const stub = stubFetch({ AAPL: { status: 200, body: APPLE_NASDAQ_USD } });
    const rows = Array.from({ length: 40 }, () => ({ symbol: 'AAPL' }));

    await fetchQuotes(rowsToSymbols(rows), stub);

    expect(stub).toHaveBeenCalledTimes(1);
  });
});

describe('symbol search', () => {
  const searchStub = (body: unknown, status = 200): FetchLike =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it('finds a UK listing, which the old hard-coded list of 28 US tickers could not', async () => {
    const matches = await searchSymbols('shell', searchStub(SEARCH_SHELL));
    expect(matches.map((m) => m.symbol)).toEqual(['SHEL.L', 'SHEL']);
    expect(matches[0]).toMatchObject({ name: 'Shell plc', exchange: 'LSE', type: 'Equity' });
  });

  it('drops rows that carry no symbol', async () => {
    const matches = await searchSymbols('shell', searchStub(SEARCH_SHELL));
    expect(matches).toHaveLength(2);
  });

  it('returns nothing for an empty query without calling upstream', async () => {
    const stub = searchStub(SEARCH_SHELL);
    expect(await searchSymbols('   ', stub)).toEqual([]);
    expect(stub).not.toHaveBeenCalled();
  });

  it('throws on an upstream failure rather than pretending nothing matched', async () => {
    // "No results" and "the lookup is broken" are different answers, and telling
    // a user their real ticker does not exist is the worse of the two.
    await expect(searchSymbols('shell', searchStub({}, 502))).rejects.toThrow(/502/);
  });
});
