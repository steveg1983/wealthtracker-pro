import { describe, it, expect } from 'vitest';
import { normaliseMoneySymbol, pricesFromMoneyTables } from './mnyPrices';

// Every figure here is invented. The SHAPES are measured from a real Money
// file (27 Aug 2026): SP rows keyed by security handle with Date objects,
// SEC carrying szSymbol/hcrnc/fPence, symbols in both `US:XXXX` and `XX.L`
// styles side by side.

const CRNC = new Map<number, string | null>([
  [18, 'GBP'],
  [45, 'USD']
]);

const sec = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  hsec: 1,
  szSymbol: 'RR.L',
  szFull: 'Rolls-Royce Holdings',
  hcrnc: 18,
  fPence: 0,
  ...over
});

const sp = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  hsec: 1,
  dt: new Date('2015-03-11T00:00:00Z'),
  dPrice: 9.5,
  src: 5,
  ...over
});

describe('normaliseMoneySymbol — Money vocabulary to the app', () => {
  it('strips the country prefix and keeps the exchange suffix', () => {
    // The two styles appear side by side in the measured register.
    expect(normaliseMoneySymbol('US:GOOG')).toBe('GOOG');
    expect(normaliseMoneySymbol('RR.L')).toBe('RR.L');
  });

  it('trims and leaves an already-bare ticker alone', () => {
    expect(normaliseMoneySymbol('  VOD  ')).toBe('VOD');
  });
});

describe('pricesFromMoneyTables', () => {
  it('reads a price into the security\'s own currency with an ISO date', () => {
    const out = pricesFromMoneyTables([sec()], [sp()], CRNC);

    expect(out.prices).toEqual([
      { symbol: 'RR.L', date: '2015-03-11', price: '9.5', currency: 'GBP' }
    ]);
    expect(out.securities).toBe(1);
    expect(out.from).toBe('2015-03-11');
    expect(out.to).toBe('2015-03-11');
  });

  it('counts a symbol-less security rather than silently narrowing', () => {
    // No-silent-caps: the confirm sentence must be able to say what was left
    // behind and why.
    const out = pricesFromMoneyTables(
      [sec(), sec({ hsec: 2, szSymbol: null })],
      [sp(), sp({ hsec: 2 })],
      CRNC
    );

    expect(out.prices).toHaveLength(1);
    expect(out.skipped.noSymbol).toBe(1);
  });

  it('refuses a pence-flagged security instead of guessing its scale', () => {
    // The measured file contains none, so the pence→pounds factor for SP is
    // unverified. Converting on an assumption would be invented data.
    const out = pricesFromMoneyTables([sec({ fPence: -1 })], [sp()], CRNC);

    expect(out.prices).toEqual([]);
    expect(out.skipped.pence).toBe(1);
  });

  it('keeps one price per symbol per day — the first, deterministically', () => {
    const out = pricesFromMoneyTables(
      [sec()],
      [sp({ dPrice: 9.5 }), sp({ dPrice: 9.7 })],
      CRNC
    );

    expect(out.prices).toHaveLength(1);
    expect(out.prices[0].price).toBe('9.5');
    expect(out.skipped.duplicates).toBe(1);
  });

  it('skips and counts an unreadable row — no date, or a negative price', () => {
    const out = pricesFromMoneyTables(
      [sec()],
      [sp({ dt: null }), sp({ dPrice: -1, dt: new Date('2015-03-12T00:00:00Z') })],
      CRNC
    );

    expect(out.prices).toEqual([]);
    expect(out.skipped.unreadable).toBe(2);
  });

  it('answers an unpriced file with an empty history, not an error', () => {
    const out = pricesFromMoneyTables([], [], CRNC);

    expect(out.prices).toEqual([]);
    expect(out.securities).toBe(0);
    expect(out.from).toBeNull();
  });

  it('sorts the series by date so the range sentence is honest', () => {
    const out = pricesFromMoneyTables(
      [sec()],
      [
        sp({ dt: new Date('2016-01-05T00:00:00Z'), dPrice: 11 }),
        sp({ dt: new Date('2010-06-01T00:00:00Z'), dPrice: 4 })
      ],
      CRNC
    );

    expect(out.from).toBe('2010-06-01');
    expect(out.to).toBe('2016-01-05');
  });
});
