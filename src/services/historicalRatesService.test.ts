import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getHistoricalRates,
  fxDayKey,
  __resetHistoricalRatesForTests,
} from './historicalRatesService';

/**
 * The on-device ECB history (the owner's backdated-rates ask, 22 Aug).
 * The provider is stubbed — these specs pin the CONTRACT: what is fetched,
 * how gaps carry, and what a dead provider degrades to.
 *
 * Every figure here is invented; the repo is public.
 */

type RangeBody = { rates: Record<string, Record<string, number>> };

const respondWith = (bodies: RangeBody[]): { calls: string[] } => {
  const calls: string[] = [];
  let call = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(String(url));
    const body = bodies[Math.min(call, bodies.length - 1)];
    call += 1;
    return { ok: true, json: async () => body } as unknown as Response;
  }));
  return { calls };
};

const providerDead = (): void => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
};

beforeEach(async () => {
  await __resetHistoricalRatesForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getHistoricalRates', () => {
  it('answers a business day with its own rate, in units per GBP', async () => {
    respondWith([{ rates: { '2017-07-28': { USD: 1.3 }, '2017-07-31': { USD: 1.32 } } }]);
    const rates = await getHistoricalRates(['USD'], new Date(2017, 6, 28), new Date(2017, 6, 31));
    expect(rates.rateOn(new Date(2017, 6, 31), 'USD')).toBe(1.32);
    expect(rates.provenance?.source).toBe('ecb-history');
  });

  it('carries a weekend from the previous business day, and GBP is always 1', async () => {
    respondWith([{ rates: { '2017-07-28': { USD: 1.3 }, '2017-07-31': { USD: 1.32 } } }]);
    const rates = await getHistoricalRates(['USD'], new Date(2017, 6, 28), new Date(2017, 6, 31));
    // Saturday the 29th answers with Friday the 28th's rate.
    expect(rates.rateOn(new Date(2017, 6, 29), 'USD')).toBe(1.3);
    expect(rates.rateOn(new Date(2017, 6, 29), 'GBP')).toBe(1);
  });

  it('carries the earliest rate backward before the series begins, and the newest forward past its end', async () => {
    respondWith([{ rates: { '2017-07-28': { USD: 1.3 }, '2017-07-31': { USD: 1.32 } } }]);
    const rates = await getHistoricalRates(['USD'], new Date(2017, 6, 28), new Date(2017, 6, 31));
    expect(rates.rateOn(new Date(1990, 0, 1), 'USD')).toBe(1.3);
    expect(rates.rateOn(new Date(2020, 0, 1), 'USD')).toBe(1.32);
  });

  it('clamps the request to the ECB epoch and asks for the currencies once each', async () => {
    const { calls } = respondWith([{ rates: { '1999-01-04': { USD: 1.65 } } }]);
    await getHistoricalRates(['USD', 'GBP'], new Date(1980, 0, 1), new Date(1999, 0, 10));
    expect(calls).toHaveLength(1);
    // The span starts at the epoch, never 1980, and GBP is not requested —
    // it is the pivot, answered as 1 without a fetch.
    expect(calls[0]).toContain('/1999-01-04..1999-01-10');
    expect(calls[0]).toContain('symbols=USD');
    expect(calls[0]).not.toContain('GBP,');
  });

  it('extends a cached span with only the missing tail', async () => {
    const { calls } = respondWith([
      { rates: { '2026-08-20': { USD: 1.3 } } },
      { rates: { '2026-08-21': { USD: 1.31 } } },
    ]);
    await getHistoricalRates(['USD'], new Date(2026, 7, 20), new Date(2026, 7, 20));
    const extended = await getHistoricalRates(['USD'], new Date(2026, 7, 20), new Date(2026, 7, 21));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('/2026-08-21..2026-08-21');
    expect(extended.rateOn(new Date(2026, 7, 21), 'USD')).toBe(1.31);
    // The first day's rate survived the merge.
    expect(extended.rateOn(new Date(2026, 7, 20), 'USD')).toBe(1.3);
  });

  it('degrades to nothing — null provenance, the currency unavailable — when the provider is dead and nothing is cached', async () => {
    providerDead();
    const rates = await getHistoricalRates(['USD'], new Date(2017, 6, 28), new Date(2017, 6, 31));
    expect(rates.provenance).toBeNull();
    expect(rates.unavailable).toEqual(['USD']);
    expect(rates.rateOn(new Date(2017, 6, 31), 'USD')).toBeNull();
  });

  it('still answers from what the device already holds when the provider dies later', async () => {
    respondWith([{ rates: { '2026-08-20': { USD: 1.3 } } }]);
    await getHistoricalRates(['USD'], new Date(2026, 7, 20), new Date(2026, 7, 20));
    vi.unstubAllGlobals();
    providerDead();
    const rates = await getHistoricalRates(['USD'], new Date(2026, 7, 20), new Date(2026, 7, 22));
    // The held day answers, and the missing tail carries forward from it.
    expect(rates.rateOn(new Date(2026, 7, 20), 'USD')).toBe(1.3);
    expect(rates.rateOn(new Date(2026, 7, 22), 'USD')).toBe(1.3);
  });
});

describe('fxDayKey', () => {
  it('is local-time, zero-padded, ISO-ordered', () => {
    expect(fxDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
