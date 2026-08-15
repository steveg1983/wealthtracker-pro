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
import { searchSymbolsTwelveData, toYahooSymbol } from '../../../api/_lib/twelvedata';

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
