import { describe, it, expect } from 'vitest';
import { buildSecurityRegister } from './securityRegister';
import type { InvestmentEvent } from './events';
import type { HoldingPricePoint } from './holdingRegister';

// Every figure invented. The SHAPES are the measured Money register: buys and
// sells carrying their own prices, dividends absent (they are cash), prices
// arriving between trades, sold-out stretches with quotes still ticking, and
// one worthless delisting.

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

const point = (date: string, price: string, source: HoldingPricePoint['source'] = 'quote'): HoldingPricePoint =>
  ({ date, price, source });

describe('buildSecurityRegister', () => {
  it('folds buy, revaluation, sell and closure — realised gain on the pooled basis', () => {
    const out = buildSecurityRegister(
      [
        event(),
        event({ id: 'e-2', date: '2013-06-01', kind: 'sell', quantity: '40', price: '12', amount: '480' }),
        event({ id: 'e-3', date: '2013-09-01', kind: 'sell', quantity: '60', price: '11', amount: '660' })
      ],
      [point('2013-03-01', '12')]
    );

    expect(
      out.lines.map((l) => ({
        kind: l.kind,
        qty: l.quantityAfter.toString(),
        amount: l.amount.toString(),
        realised: l.realised?.toString() ?? null,
        running: l.runningValue.toString()
      }))
    ).toEqual([
      { kind: 'buy', qty: '100', amount: '1000', realised: null, running: '1000' },
      { kind: 'revaluation', qty: '100', amount: '200', realised: null, running: '1200' },
      // 40 units leave at the pool's £10 average: realised 480 − 400 = 80.
      { kind: 'sell', qty: '60', amount: '-480', realised: '80', running: '720' },
      { kind: 'sell', qty: '0', amount: '-660', realised: '60', running: '0' }
    ]);
    expect(out.endQuantity.isZero()).toBe(true);
    expect(out.invested.toString()).toBe('1000');
    expect(out.proceeds.toString()).toBe('1140');
    // For a fully-closed position, realised = proceeds − invested. Always.
    expect(out.realisedGain.toString()).toBe('140');
  });

  it('lands a buy at cost and lets the next price absorb the fees', () => {
    const out = buildSecurityRegister(
      [event({ amount: '1012.5', fees: '12.5' })],
      [point('2013-02-01', '10')]
    );

    expect(out.lines.map((l) => l.runningValue.toString())).toEqual(['1012.5', '1000']);
    expect(out.lines[1].amount.toString()).toBe('-12.5');
  });

  it('counts prices from before the first trade, and never draws them', () => {
    const out = buildSecurityRegister([event()], [point('2010-01-01', '3', 'import')]);

    expect(out.lines).toHaveLength(1);
    expect(out.skipped.pricesBeforeFirstTrade).toBe(1);
  });

  it('counts prices from a sold-out stretch — nothing held is nothing to revalue', () => {
    // The measured shape: sold out in January, back in by July, quotes
    // ticking in between.
    const out = buildSecurityRegister(
      [
        event(),
        event({ id: 'e-2', date: '2013-02-01', kind: 'sell', quantity: '100', price: '11', amount: '1100' }),
        event({ id: 'e-3', date: '2013-07-01', kind: 'buy', quantity: '50', price: '9', amount: '450' })
      ],
      [point('2013-04-01', '12'), point('2013-08-01', '10')]
    );

    expect(out.skipped.pricesWhileNothingHeld).toBe(1);
    const last = out.lines[out.lines.length - 1];
    expect(last.kind).toBe('revaluation');
    expect(last.runningValue.toString()).toBe('500'); // 50 × 10
  });

  it('realises a write-off as the pooled cost lost, receiving nothing', () => {
    const out = buildSecurityRegister(
      [event(), event({ id: 'e-2', date: '2016-10-26', kind: 'write_off', price: null, amount: '0' })],
      []
    );

    const writeOff = out.lines[1];
    expect(writeOff.amount.isZero()).toBe(true);
    expect(writeOff.realised?.toString()).toBe('-1000');
    expect(out.endQuantity.isZero()).toBe(true);
    expect(out.endValue.isZero()).toBe(true);
    expect(out.realisedGain.toString()).toBe('-1000');
  });

  it('clamps a sell of more than is held, and counts it as broken data', () => {
    const out = buildSecurityRegister(
      [event(), event({ id: 'e-2', date: '2013-02-01', kind: 'sell', quantity: '150', price: '10', amount: '1500' })],
      []
    );

    expect(out.skipped.soldMoreThanHeld).toBe(1);
    expect(out.endQuantity.isZero()).toBe(true);
    // The clamp is about the POOL, not the money: the proceeds are what they
    // were, so realised carries the full receipt against the whole pool.
    expect(out.realisedGain.toString()).toBe('500');
  });

  it('derives a trades-only register when there is no price series', () => {
    // A symbol-less security: 11 of the owner's have no ticker, so no prices
    // — the register is its trades, honestly.
    const out = buildSecurityRegister(
      [event(), event({ id: 'e-2', date: '2013-06-01', kind: 'sell', quantity: '100', price: '13', amount: '1300' })],
      []
    );

    expect(out.lines.map((l) => l.kind)).toEqual(['buy', 'sell']);
    expect(out.realisedGain.toString()).toBe('300');
  });

  it('lets a same-day quote re-anchor AFTER the trade, not before it', () => {
    const out = buildSecurityRegister(
      [event()],
      [point('2013-01-10', '11')]
    );

    // Buy at cost first; the day's quote then revalues 100 × 11.
    expect(out.lines.map((l) => ({ kind: l.kind, running: l.runningValue.toString() }))).toEqual([
      { kind: 'buy', running: '1000' },
      { kind: 'revaluation', running: '1100' }
    ]);
  });
});
