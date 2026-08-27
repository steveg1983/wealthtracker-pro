import { describe, it, expect } from 'vitest';
import { toDecimal } from '../../utils/decimal';
import { buildInvestmentValuation, type SymbolPricePoint } from './investmentValuation';
import type { InvestmentEvent } from './events';
import type { InvestmentHolding } from './holding';

// Every figure invented. What these specs pin is the DELTA CONTRACT: the
// derived term net worth adds on top of the ledger — zero at cost, market
// minus pooled cost while a priced position is open, zero again when it
// closes — and that it tells the SAME story as the registers (event prices
// re-anchor; fees surface as the small negative the absorption ruling
// prescribes).

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

describe('buildInvestmentValuation', () => {
  it('is zero before the first trade, market − cost while open, zero after close', () => {
    const v = buildInvestmentValuation(
      [
        event({ price: null }), // buy at bare cost, no anchor yet
        event({ id: 'e-2', date: '2013-06-01', kind: 'sell', quantity: '100', price: '12', amount: '1200' })
      ],
      [],
      [price('2013-03-01', '11')]
    );

    expect(v.deltaAt('acct-1', '2012-12-31').toString()).toBe('0');
    expect(v.deltaAt('acct-1', '2013-01-10').toString()).toBe('0'); // at cost
    expect(v.deltaAt('acct-1', '2013-03-01').toString()).toBe('100'); // 100×11 − 1000
    expect(v.deltaAt('acct-1', '2013-04-15').toString()).toBe('100'); // holds between prices
    expect(v.deltaAt('acct-1', '2013-06-01').toString()).toBe('0'); // sold out
    expect(v.deltaAt('acct-1', '2099-01-01').toString()).toBe('0');
    expect(v.accountIds.has('acct-1')).toBe(true);
  });

  it('surfaces a buy\'s fees at once — the register\'s fees-absorption, as a delta', () => {
    // Buy 100 at £10 with £12.50 charges: the trade's own price anchors, so
    // the position is worth 1000 against 1012.50 of pooled cost immediately.
    const v = buildInvestmentValuation([event({ amount: '1012.5' })], [], []);

    expect(v.deltaAt('acct-1', '2013-01-10').toString()).toBe('-12.5');
  });

  it('values the remainder of a partial sell at the sale\'s own price', () => {
    const v = buildInvestmentValuation(
      [
        event({ price: null }),
        event({ id: 'e-2', date: '2013-06-01', kind: 'sell', quantity: '40', price: '12', amount: '480' })
      ],
      [],
      []
    );

    // 60 left × £12 anchor − £600 remaining pool cost.
    expect(v.deltaAt('acct-1', '2013-06-01').toString()).toBe('120');
  });

  it('counts an unpriced position and keeps it at cost', () => {
    const v = buildInvestmentValuation([event({ symbol: null, price: null })], [], []);

    expect(v.deltaAt('acct-1', '2020-01-01').toString()).toBe('0');
    expect(v.unpricedPositions).toBe(1);
  });

  it('refuses to mix currencies — the position counts at cost, and is counted', () => {
    const v = buildInvestmentValuation(
      [event({ price: null })],
      [],
      [price('2013-03-01', '15', { currency: 'USD' })]
    );

    expect(v.deltaAt('acct-1', '2013-03-01').toString()).toBe('0');
    expect(v.currencyMismatches).toBe(1);
  });

  it('ignores prices from a sold-out stretch, like the registers', () => {
    const v = buildInvestmentValuation(
      [
        event({ price: null }),
        event({ id: 'e-2', date: '2013-02-01', kind: 'sell', quantity: '100', price: '11', amount: '1100' }),
        event({ id: 'e-3', date: '2013-07-01', quantity: '50', price: '9', amount: '450' })
      ],
      [],
      [price('2013-04-01', '20'), price('2013-08-01', '10')]
    );

    expect(v.deltaAt('acct-1', '2013-04-01').toString()).toBe('0'); // nothing held
    // The stale £20 must NOT anchor the July re-buy; its own £9 does, then
    // August's £10 revalues: 50×10 − 450.
    expect(v.deltaAt('acct-1', '2013-07-01').toString()).toBe('0');
    expect(v.deltaAt('acct-1', '2013-08-01').toString()).toBe('50');
  });

  it('values an event-less holding constantly since purchase, from the price table', () => {
    const v = buildInvestmentValuation(
      [],
      [holding()],
      [price('2021-01-01', '12', { symbol: 'DEF.L' })]
    );

    expect(v.deltaAt('acct-9', '2020-05-31').toString()).toBe('0'); // before purchase
    expect(v.deltaAt('acct-9', '2020-06-01').toString()).toBe('0'); // at cost
    expect(v.deltaAt('acct-9', '2021-01-01').toString()).toBe('100'); // 50×12 − 500
  });

  it('prefers events over a holding row for the same position — never both', () => {
    const v = buildInvestmentValuation(
      [event({ accountId: 'acct-9', symbol: 'DEF.L', securityName: 'Definite Articles', quantity: '50', amount: '500', price: null })],
      [holding()],
      [price('2021-01-01', '12', { symbol: 'DEF.L' })]
    );

    // One position's worth of delta, not two.
    expect(v.deltaAt('acct-9', '2021-01-01').toString()).toBe('100');
  });

  it('sums two securities\' deltas within one account', () => {
    const v = buildInvestmentValuation(
      [
        event({ price: null }),
        event({ id: 'e-2', symbol: 'XYZ', securityName: 'Xylophone Group', quantity: '10', amount: '50', price: null })
      ],
      [],
      [price('2013-03-01', '11'), price('2013-04-01', '6', { symbol: 'XYZ' })]
    );

    expect(v.deltaAt('acct-1', '2013-03-01').toString()).toBe('100'); // ABC alone
    expect(v.deltaAt('acct-1', '2013-04-01').toString()).toBe('110'); // + (10×6 − 50)
  });

  it('keeps accounts separate', () => {
    const v = buildInvestmentValuation(
      [event({ price: null }), event({ id: 'e-2', accountId: 'acct-2', price: null })],
      [],
      [price('2013-03-01', '11')]
    );

    expect(v.deltaAt('acct-1', '2013-03-01').toString()).toBe('100');
    expect(v.deltaAt('acct-2', '2013-03-01').toString()).toBe('100');
    expect(v.deltaAt('acct-3', '2013-03-01').toString()).toBe('0');
  });
});
