import { describe, it, expect } from 'vitest';
import { getEffectiveBudgetAmount, sumBudgetCarry } from './budgetAmounts';
import { toDecimal } from './decimal';

describe('getEffectiveBudgetAmount', () => {
  it('returns the planned amount when nothing is being carried', () => {
    expect(getEffectiveBudgetAmount({ amount: 250 }).toNumber()).toBe(250);
  });

  it('adds the carry when rollover is on', () => {
    expect(getEffectiveBudgetAmount({ amount: 250, rollover: true, rolloverAmount: 50 }).toNumber()).toBe(300);
  });

  it('ignores a stale carry when rollover is off', () => {
    expect(getEffectiveBudgetAmount({ amount: 250, rollover: false, rolloverAmount: 50 }).toNumber()).toBe(250);
  });

  it('treats a missing carry as zero', () => {
    expect(getEffectiveBudgetAmount({ amount: 250, rollover: true }).toNumber()).toBe(250);
  });

  it('adds without floating-point drift', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in raw JS.
    expect(getEffectiveBudgetAmount({ amount: 0.1, rollover: true, rolloverAmount: 0.2 }).toString()).toBe('0.3');
  });

  it('accepts a budget that has already been decimalised', () => {
    expect(
      getEffectiveBudgetAmount({ amount: toDecimal('19.99'), rollover: true, rolloverAmount: 0.01 }).toString()
    ).toBe('20');
  });

  it('carries a negative balance forward when one was applied', () => {
    expect(getEffectiveBudgetAmount({ amount: 100, rollover: true, rolloverAmount: -25 }).toNumber()).toBe(75);
  });
});

describe('sumBudgetCarry', () => {
  it('sums only the budgets that are carrying', () => {
    const total = sumBudgetCarry([
      { amount: 100, rollover: true, rolloverAmount: 10 },
      { amount: 100, rollover: false, rolloverAmount: 999 },
      { amount: 100, rollover: true, rolloverAmount: 0.05 },
      { amount: 100 }
    ]);
    expect(total.toString()).toBe('10.05');
  });

  it('is zero for an empty list', () => {
    expect(sumBudgetCarry([]).toNumber()).toBe(0);
  });
});
