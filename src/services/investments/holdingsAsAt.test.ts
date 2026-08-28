import { describe, it, expect } from 'vitest';
import { toDecimal } from '../../utils/decimal';
import { buildHoldingsAsAt } from './holdingsAsAt';
import type { InvestmentEvent } from './events';
import type { InvestmentHolding } from './holding';
import type { SymbolPricePoint } from './investmentValuation';

// Every figure invented. What these specs pin is the AS-AT contract: the
// fold stops at the date, a closed position is absent rather than zero, and
// nothing is valued from a price the position's own money cannot be
// compared with.

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

const price = (date: string, p: string, over: Partial<SymbolPricePoint> = {}): SymbolPricePoint => ({
  symbol: 'ABC.L',
  date,
  price: p,
  currency: 'GBP',
  ...over
});

const holding = (over: Partial<InvestmentHolding> = {}): InvestmentHolding => ({
  id: 'inv-1',
  accountId: 'acct-9',
  symbol: 'DEF.L',
  name: 'Definite Articles',
  quantity: toDecimal('50'),
  costBasis: toDecimal('500'),
  averageCost: toDecimal('10'),
  currentPrice: null,
  marketValue: null,
  currency: 'GBP',
  assetType: 'stock',
  purchaseDate: new Date('2020-06-01T00:00:00Z'),
  purchasePrice: toDecimal('10'),
  lastUpdated: null,
  notes: '',
  ...over
});

describe('buildHoldingsAsAt', () => {
  it('folds to the date and values at the last price on or before it', () => {
    const out = buildHoldingsAsAt(
      [event(), event({ id: 'e-2', date: '2013-06-01', quantity: '50', amount: '600' })],
      [],
      [price('2013-03-01', '11'), price('2013-09-01', '20')],
      '2013-07-01'
    );

    expect(out.positions).toHaveLength(1);
    const position = out.positions[0];
    // Both buys are before the as-at day; the September price is after it.
    expect(position.quantity.toString()).toBe('150');
    expect(position.cost.toString()).toBe('1600');
    expect(position.price?.toString()).toBe('11');
    expect(position.priceDate).toBe('2013-03-01');
    expect(position.value?.toString()).toBe('1650');
    expect(position.gain?.toString()).toBe('50');
  });

  it('ignores events after the as-at day — the report is a snapshot', () => {
    const out = buildHoldingsAsAt(
      [event(), event({ id: 'e-2', date: '2014-01-01', kind: 'sell', quantity: '100', amount: '1300' })],
      [],
      [],
      '2013-12-31'
    );

    expect(out.positions[0].quantity.toString()).toBe('100');
  });

  it('leaves a closed position ABSENT rather than listing a zero row', () => {
    const out = buildHoldingsAsAt(
      [event(), event({ id: 'e-2', date: '2013-06-01', kind: 'sell', quantity: '100', amount: '1300' })],
      [],
      [],
      '2013-12-31'
    );

    expect(out.positions).toEqual([]);
  });

  it('removes units at the pooled cost, so the remainder carries its share', () => {
    const out = buildHoldingsAsAt(
      [event(), event({ id: 'e-2', date: '2013-06-01', kind: 'sell', quantity: '40', amount: '520' })],
      [],
      [],
      '2013-12-31'
    );

    expect(out.positions[0].quantity.toString()).toBe('60');
    expect(out.positions[0].cost.toString()).toBe('600');
  });

  it('counts an unpriced position and states it at cost', () => {
    const out = buildHoldingsAsAt([event({ symbol: null })], [], [], '2013-12-31');

    expect(out.positions[0].value).toBeNull();
    expect(out.positions[0].gain).toBeNull();
    expect(out.unpriced).toBe(1);
  });

  it('refuses a price in another currency, and counts that separately', () => {
    const out = buildHoldingsAsAt(
      [event()],
      [],
      [price('2013-03-01', '15', { currency: 'USD' })],
      '2013-12-31'
    );

    expect(out.positions[0].value).toBeNull();
    expect(out.currencyMismatches).toBe(1);
    expect(out.unpriced).toBe(0);
  });

  it('includes an event-less holding from its purchase day, and not before', () => {
    const before = buildHoldingsAsAt([], [holding()], [], '2020-05-31');
    expect(before.positions).toEqual([]);

    const after = buildHoldingsAsAt(
      [],
      [holding()],
      [price('2021-01-01', '12', { symbol: 'DEF.L' })],
      '2021-06-30'
    );
    expect(after.positions[0]).toMatchObject({ source: 'holding' });
    expect(after.positions[0].value?.toString()).toBe('600');
  });

  it('prefers events over a holding row for the same position — never both', () => {
    const out = buildHoldingsAsAt(
      [event({ accountId: 'acct-9', symbol: 'DEF.L', securityName: 'Definite Articles', quantity: '50', amount: '500' })],
      [holding()],
      [],
      '2026-01-01'
    );

    expect(out.positions).toHaveLength(1);
    expect(out.positions[0].source).toBe('events');
  });

  it('sorts by security name', () => {
    const out = buildHoldingsAsAt(
      [
        event({ symbol: 'ZZZ', securityName: 'Zebra Ltd' }),
        event({ id: 'e-2', symbol: 'AAA', securityName: 'Aardvark Ltd' })
      ],
      [],
      [],
      '2026-01-01'
    );

    expect(out.positions.map((p) => p.securityName)).toEqual(['Aardvark Ltd', 'Zebra Ltd']);
  });
});
