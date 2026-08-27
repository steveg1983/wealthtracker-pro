import { describe, it, expect } from 'vitest';
import { toDecimal } from '../../utils/decimal';
import { buildHoldingRegister, type HoldingPricePoint } from './holdingRegister';

// Every figure invented. The SHAPE is the owner's Money register mock-up:
// Buy, then dated revaluations, running value always quantity × latest price.

const holding = (over: Partial<Parameters<typeof buildHoldingRegister>[0]> = {}) => ({
  quantity: toDecimal('100'),
  costBasis: toDecimal('1000'),
  purchaseDate: new Date('2026-01-10T00:00:00Z'),
  purchasePrice: toDecimal('9.8'),
  ...over
});

const point = (date: string, price: string, source: HoldingPricePoint['source'] = 'quote'): HoldingPricePoint =>
  ({ date, price, source });

describe('buildHoldingRegister — the Money shape, derived', () => {
  it('opens with the buy at cost, then one revaluation per price, running to market value', () => {
    const out = buildHoldingRegister(holding(), [
      point('2026-02-01', '11'),
      point('2026-03-01', '9')
    ]);

    expect(out.lines.map((l) => ({ kind: l.kind, amount: l.amount.toString(), running: l.runningValue.toString() }))).toEqual([
      { kind: 'buy', amount: '1000', running: '1000' },
      // 100 × 11 = 1100; the +100 absorbs both the market move and the fees
      // inside the cost basis — value now versus what it cost.
      { kind: 'revaluation', amount: '100', running: '1100' },
      { kind: 'revaluation', amount: '-200', running: '900' }
    ]);
    expect(out.value.toString()).toBe('900');
    expect(out.gain.toString()).toBe('-100');
  });

  it('ignores — and counts — prices from before the position existed', () => {
    // Eight imported years of a security’s prices are not revaluations of a
    // holding bought last month.
    const out = buildHoldingRegister(holding(), [
      point('2012-05-01', '3', 'import'),
      point('2026-02-01', '11')
    ]);

    expect(out.lines).toHaveLength(2);
    expect(out.pricesBeforePurchase).toBe(1);
  });

  it('sorts an unordered series before deriving', () => {
    const out = buildHoldingRegister(holding(), [
      point('2026-03-01', '9'),
      point('2026-02-01', '11')
    ]);

    expect(out.lines.map((l) => l.date)).toEqual(['2026-01-10', '2026-02-01', '2026-03-01']);
    expect(out.value.toString()).toBe('900');
  });

  it('drops a zero-movement line as noise', () => {
    const out = buildHoldingRegister(holding({ costBasis: toDecimal('1100') }), [
      point('2026-02-01', '11') // 100 × 11 = exactly the cost basis
    ]);

    expect(out.lines).toHaveLength(1);
    expect(out.value.toString()).toBe('1100');
  });

  it('answers an unpriced holding with just the buy, at cost', () => {
    const out = buildHoldingRegister(holding(), []);

    expect(out.lines).toHaveLength(1);
    expect(out.value.toString()).toBe('1000');
    expect(out.gain.isZero()).toBe(true);
  });

  it('uses every price when the purchase date was never recorded', () => {
    const out = buildHoldingRegister(holding({ purchaseDate: null }), [
      point('2012-05-01', '3', 'import')
    ]);

    expect(out.lines).toHaveLength(2);
    expect(out.pricesBeforePurchase).toBe(0);
  });
});
