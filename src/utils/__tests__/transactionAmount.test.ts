import { describe, it, expect } from 'vitest';
import { signTransactionAmount } from '../transactionAmount';

describe('signTransactionAmount', () => {
  it('stores expenses as negative regardless of input sign', () => {
    expect(signTransactionAmount(100, 'expense')).toBe(-100);
    expect(signTransactionAmount(-100, 'expense')).toBe(-100); // already-negative input
    expect(signTransactionAmount(0, 'expense')).toBe(0); // zero stays +0, not -0
  });

  it('stores income as positive regardless of input sign', () => {
    expect(signTransactionAmount(100, 'income')).toBe(100);
    expect(signTransactionAmount(-100, 'income')).toBe(100);
  });

  it('signs transfers by direction', () => {
    expect(signTransactionAmount(50, 'transfer', true)).toBe(-50);  // outgoing
    expect(signTransactionAmount(50, 'transfer', false)).toBe(50);  // incoming
    expect(signTransactionAmount(50, 'transfer')).toBe(-50);        // defaults to outgoing
  });

  it('REGRESSION: editing a magnitude-seeded expense keeps it negative', () => {
    // The edit form seeds Math.abs(amount), so a −£100 expense arrives here as
    // +100. The bug stored it as +100 (sign flip + balance double-swing). It
    // MUST come back out as −100.
    const formMagnitude = Math.abs(-100);
    expect(signTransactionAmount(formMagnitude, 'expense')).toBe(-100);
  });
});
