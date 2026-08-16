/**
 * SYMBOL SEARCH, AND THE PROVIDER THAT ANSWERS IT.
 *
 * The reason this exists: Yahoo's search is unkeyed and rate-limits by IP, and
 * a Vercel function shares its egress IP with other customers — so the limit
 * hit is one this app did not spend. Measured 15 August: 429 from both Yahoo
 * hosts and from Yahoo's own crumb endpoint, while the app was making a handful
 * of calls a day. A key attaches quota to us rather than to an address.
 *
 * The tests that matter most are the TRANSLATION ones. A symbol picked in
 * search is stored on the holding and later priced by the Yahoo quote path, so
 * a provider returning `SHEL` where Yahoo wants `SHEL.L` has not failed
 * loudly — it has handed back a holding that silently never prices, which looks
 * exactly like success until a price fails to arrive weeks later.
 */
import { describe, it, expect, vi } from 'vitest';
import { searchSymbolsVia, activeSymbolSearchProvider } from '../../../api/_lib/symbolSearch';
import { searchSymbolsTwelveData, toYahooSymbol, fetchQuoteTwelveData, isUnsuffixedSymbol, toTwelveDataQuoteRequest } from '../../../api/_lib/twelvedata';

const KEYED = { TWELVE_DATA_API_KEY: 'test-key' } as NodeJS.ProcessEnv;
const UNKEYED = {} as NodeJS.ProcessEnv;

const twelveDataBody = (rows: unknown[]) => ({ data: rows });

const stub = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('the symbol a search returns must be one the quote path can price', () => {
  it('gives an LSE listing the .L Yahoo wants', () => {
    expect(toYahooSymbol({ symbol: 'SHEL', exchange: 'LSE', micCode: 'XLON' })).toBe('SHEL.L');
  });

  it('leaves a US listing bare, which is what Yahoo takes', () => {
    expect(toYahooSymbol({ symbol: 'AAPL', exchange: 'NASDAQ', micCode: 'XNAS' })).toBe('AAPL');
    expect(toYahooSymbol({ symbol: 'BRK.B', exchange: 'NYSE', micCode: 'XNYS' })).toBe('BRK.B');
  });

  it('falls back to the MIC when the exchange name is unfamiliar', () => {
    // Providers spell exchange names inconsistently; MICs are the standard.
    expect(toYahooSymbol({ symbol: 'SHEL', exchange: 'London Stock Exch.', micCode: 'XLON' }))
      .toBe('SHEL.L');
  });

  it('does not append a second suffix to a symbol that already carries one', () => {
    expect(toYahooSymbol({ symbol: 'SHEL.L', exchange: 'LSE', micCode: 'XLON' })).toBe('SHEL.L');
  });

  it('DROPS an exchange it cannot translate, rather than offering a dead symbol', () => {
    /*
     * The important one. Offering a result that cannot price is the same
     * offence as a dead toggle: it accepts the choice and fails silently
     * afterwards. Both fields stay typeable by hand, so dropping never blocks
     * recording a holding — it only stops the app suggesting one it cannot keep.
     */
    expect(toYahooSymbol({ symbol: 'ABC', exchange: 'Bourse de Nowhere', micCode: 'XZZZ' }))
      .toBeNull();
  });

  it('drops an empty symbol', () => {
    expect(toYahooSymbol({ symbol: '   ', exchange: 'LSE', micCode: 'XLON' })).toBeNull();
  });
});

describe('the Twelve Data adapter', () => {
  it('maps a mixed UK/US response into Yahoo dialect', async () => {
    const matches = await searchSymbolsTwelveData('shell', {
      apiKey: 'k',
      fetchImpl: stub(twelveDataBody([
        { symbol: 'SHEL', instrument_name: 'Shell plc', exchange: 'LSE', mic_code: 'XLON', instrument_type: 'Common Stock' },
        { symbol: 'SHEL', instrument_name: 'Shell plc ADR', exchange: 'NYSE', mic_code: 'XNYS', instrument_type: 'Common Stock' }
      ]))
    });

    expect(matches.map((m) => m.symbol)).toEqual(['SHEL.L', 'SHEL']);
    expect(matches[0]).toMatchObject({ name: 'Shell plc', exchange: 'LSE' });
  });

  it('treats a 200 carrying an error code as a failure, not as "no results"', async () => {
    /*
     * Twelve Data answers 200 with `{ code, message }` for a bad key or an
     * exhausted plan. Reading that as an empty list would tell somebody their
     * real ticker does not exist — the single most misleading thing a lookup
     * can do.
     */
    await expect(
      searchSymbolsTwelveData('shell', {
        apiKey: 'k',
        fetchImpl: stub({ code: 429, message: 'You have run out of API credits' })
      })
    ).rejects.toMatchObject({ upstreamStatus: 429 });
  });

  it('sends the key as a header, never in the URL', async () => {
    // Vercel logs full URLs; a key in a log is a key that has leaked.
    const fetchImpl = stub(twelveDataBody([]));
    await searchSymbolsTwelveData('shell', { apiKey: 'secret-key', fetchImpl });

    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).not.toContain('secret-key');
    expect((init.headers as Record<string, string>).Authorization).toContain('secret-key');
  });

  it('returns nothing for an empty query without calling upstream', async () => {
    const fetchImpl = stub(twelveDataBody([]));
    expect(await searchSymbolsTwelveData('   ', { apiKey: 'k', fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('choosing the provider', () => {
  it('uses Yahoo when no key is configured, so adding one is a deployment', () => {
    expect(activeSymbolSearchProvider(UNKEYED)).toBe('yahoo');
    expect(activeSymbolSearchProvider(KEYED)).toBe('twelvedata');
  });

  it('treats a blank key as no key', () => {
    expect(activeSymbolSearchProvider({ TWELVE_DATA_API_KEY: '   ' } as NodeJS.ProcessEnv))
      .toBe('yahoo');
  });

  it('falls back to Yahoo when Twelve Data fails, and says which failed', async () => {
    const onProviderError = vi.fn();
    // Twelve Data 500s; Yahoo answers. One fetch stub serves both, branching on
    // the host, which is also how the real failover is exercised.
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('twelvedata')
        ? new Response('{}', { status: 500 })
        : new Response(JSON.stringify({ quotes: [{ symbol: 'AAPL', longname: 'Apple Inc.' }] }), { status: 200 })
    ) as unknown as typeof fetch;

    const matches = await searchSymbolsVia('apple', { env: KEYED, fetchImpl, onProviderError });

    expect(matches.map((m) => m.symbol)).toEqual(['AAPL']);
    expect(onProviderError).toHaveBeenCalledWith('twelvedata', expect.anything());
  });

  it('does not call Twelve Data at all when there is no key', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ quotes: [{ symbol: 'AAPL', longname: 'Apple Inc.' }] }), { status: 200 })
    ) as unknown as typeof fetch;

    await searchSymbolsVia('apple', { env: UNKEYED, fetchImpl });

    const calls = (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls;
    expect(calls.every(([url]) => !url.includes('twelvedata'))).toBe(true);
  });
});

describe('prices: which provider, and in what unit', () => {
  /*
   * The 429s were never only about search — `fetchQuote` hit the same shared
   * egress IP, so the watchlist could FIND a symbol it could not then price.
   *
   * What makes this dangerous rather than merely broken is the unit. Yahoo
   * reports LSE equities in PENCE and labels them `GBp`, and the quote path
   * divides by a hundred on that label. A provider that returns 3277.5 while
   * calling it `GBP` would make a UK holding a hundred times too valuable,
   * silently, in a ledger measured in millions.
   */
  it('routes bare symbols AND the verified .L, and nothing else', () => {
    /*
     * The guard, widened by exactly one entry on 16 August: the owner
     * upgraded to Grow and priced Vodafone by hand — `symbol=VOD&exchange=LSE`
     * answered `"currency":"GBp"`, pence correctly labelled — so `.L` has a
     * verified translation. `.DE` and `.TO` have not been exercised the same
     * way and stay on Yahoo, because a symbol priced on the wrong exchange
     * can look plausible for weeks.
     */
    expect(isUnsuffixedSymbol('AAPL')).toBe(true);
    expect(toTwelveDataQuoteRequest('AAPL')).toEqual({ symbol: 'AAPL' });
    expect(toTwelveDataQuoteRequest('VOD.L')).toEqual({ symbol: 'VOD', exchange: 'LSE' });
    expect(toTwelveDataQuoteRequest('APC.DE')).toBeNull();
    expect(toTwelveDataQuoteRequest('AAPL.TO')).toBeNull();
    expect(toTwelveDataQuoteRequest('.L')).toBeNull();
  });

  it('asks Twelve Data in ITS dialect and answers in Yahoo\'s', async () => {
    /*
     * The owner's first curl proved `VOD.L` is not a symbol Twelve Data
     * knows; the second proved `VOD&exchange=LSE` is. And the caller keys
     * its maps by what it asked for, so the answer must come back as VOD.L —
     * a quote under a different name never lands on its holding.
     */
    const fetchImpl = stub({
      symbol: 'VOD', name: 'Vodafone Group Public Limited Company',
      close: '121.55', currency: 'GBp', datetime: '2026-08-14'
    });
    const result = await fetchQuoteTwelveData('VOD.L', { apiKey: 'k', fetchImpl });

    const [url] = (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls[0];
    expect(url).toContain('symbol=VOD');
    expect(url).toContain('exchange=LSE');
    expect(url).not.toContain('VOD.L');

    expect(result).toMatchObject({ symbol: 'VOD.L', price: '121.55', currency: 'GBp' });
  });

  it('reads the price and the currency from the response', async () => {
    const quote = await fetchQuoteTwelveData('AAPL', {
      apiKey: 'k',
      fetchImpl: stub({
        symbol: 'AAPL', name: 'Apple Inc.', close: '229.35',
        previous_close: '227.10', currency: 'USD', datetime: '2026-08-15'
      })
    });
    expect(quote).toMatchObject({ symbol: 'AAPL', price: '229.35', currency: 'USD' });
    expect(quote?.asOf).toMatch(/^2026-08-15T/);
  });

  it('does NOT convert the unit itself — that is the caller\'s table', async () => {
    // The unit must travel as the provider stated it, so the ONE conversion
    // table serves both providers. Converting here would mean two places to be
    // right about pence, which is one too many.
    const quote = await fetchQuoteTwelveData('SHEL', {
      apiKey: 'k',
      fetchImpl: stub({ symbol: 'SHEL', close: '3277.5', currency: 'GBp', datetime: '2026-08-15' })
    });
    expect(quote?.price).toBe('3277.5');
    expect(quote?.currency).toBe('GBp');
  });

  it('treats a 200 carrying an error code as a failure, not as "no price"', async () => {
    // Reading an exhausted plan as "no price" would leave yesterday's figure
    // on screen as though it were today's.
    await expect(
      fetchQuoteTwelveData('AAPL', {
        apiKey: 'k',
        fetchImpl: stub({ code: 429, message: 'You have run out of API credits' })
      })
    ).rejects.toMatchObject({ upstreamStatus: 429 });
  });

  it('refuses a price with NO CURRENCY rather than guessing at one', async () => {
    /*
     * The guard that matters most after the suffix one. A number with no
     * currency is not a price — assuming USD would value a UK share in
     * dollars, and assuming the account's own currency would be worse still
     * because it would look right. Null falls back to Yahoo, which states one.
     */
    const quote = await fetchQuoteTwelveData('AAPL', {
      apiKey: 'k',
      fetchImpl: stub({ symbol: 'AAPL', close: '229.35', datetime: '2026-08-15' })
    });
    expect(quote).toBeNull();
  });

  it('returns null rather than a price of zero when there is no close', async () => {
    const quote = await fetchQuoteTwelveData('AAPL', {
      apiKey: 'k',
      fetchImpl: stub({ symbol: 'AAPL', currency: 'USD' })
    });
    expect(quote).toBeNull();
  });
});
