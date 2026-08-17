import { describe, it, expect } from 'vitest';
import { toDecimal } from '../../utils/decimal';
import { allInAverageCost, purchaseCashTotal } from './purchaseMath';

/** Every figure invented — the repo is public. */
describe('allInAverageCost — charges fold into the per-unit figure', () => {
  it('spreads the charges across the units, Money-style', () => {
    // 100 units at 5.00 plus 25.00 of stamp duty: 525 ÷ 100.
    const allIn = allInAverageCost(toDecimal(100), toDecimal(5), toDecimal(25));
    expect(allIn.toNumber()).toBe(5.25);
  });

  it('cost basis derived from it is the money actually spent', () => {
    const quantity = toDecimal(3);
    const allIn = allInAverageCost(quantity, toDecimal(33.333), toDecimal(1));
    // 3 × 33.333 + 1 = 100.999 exactly — Decimal, no float drift.
    expect(quantity.times(allIn).toNumber()).toBe(100.999);
  });

  it('zero charges change nothing', () => {
    const allIn = allInAverageCost(toDecimal(8), toDecimal(12.5), toDecimal(0));
    expect(allIn.toNumber()).toBe(12.5);
  });

  it('a zero-unit purchase cannot divide — the entered cost stands', () => {
    const allIn = allInAverageCost(toDecimal(0), toDecimal(12.5), toDecimal(9));
    expect(allIn.toNumber()).toBe(12.5);
  });
});

describe('purchaseCashTotal — what leaves the cash account', () => {
  it('is units × price + charges', () => {
    expect(purchaseCashTotal(toDecimal(100), toDecimal(5), toDecimal(25)).toNumber()).toBe(525);
  });

  it('is the gross alone when there are no charges', () => {
    expect(purchaseCashTotal(toDecimal(2), toDecimal(7.75), toDecimal(0)).toNumber()).toBe(15.5);
  });
});
