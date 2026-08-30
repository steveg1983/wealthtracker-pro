import { describe, it, expect } from 'vitest';
import { refoldPosition } from './refoldPosition';

/**
 * The snapshot a deleted trade leaves behind — re-derived, never patched.
 * Every figure invented: this repo is public.
 */
describe('refoldPosition', () => {
  it('one surviving buy: the pool is that buy exactly', () => {
    const fold = refoldPosition([{ kind: 'buy', quantity: '8587.805', amount: '9993.63' }]);
    expect(fold).not.toBeNull();
    expect(fold!.quantity.toString()).toBe('8587.805');
    // 9993.63 ÷ 8587.805 — the average keeps its places.
    expect(fold!.averageCost.toDecimalPlaces(4).toString()).toBe('1.1637');
  });

  it('two buys pool their cost — the blended average, fees in', () => {
    const fold = refoldPosition([
      { kind: 'buy', quantity: '100', amount: '1000' },
      { kind: 'buy', quantity: '100', amount: '1500' },
    ]);
    expect(fold!.quantity.toString()).toBe('200');
    expect(fold!.averageCost.toString()).toBe('12.5');
  });

  it('a sell removes its proportional cost, the registers’ own rule', () => {
    const fold = refoldPosition([
      { kind: 'buy', quantity: '200', amount: '2000' },
      { kind: 'sell', quantity: '50', amount: '700' },
    ]);
    expect(fold!.quantity.toString()).toBe('150');
    // Pool cost 2000 − (2000 × 50/200) = 1500; average unchanged at 10.
    expect(fold!.averageCost.toString()).toBe('10');
  });

  it('an empty or sold-out history has no snapshot to state', () => {
    expect(refoldPosition([])).toBeNull();
    expect(
      refoldPosition([
        { kind: 'buy', quantity: '10', amount: '100' },
        { kind: 'sell', quantity: '10', amount: '120' },
      ])
    ).toBeNull();
  });
});
