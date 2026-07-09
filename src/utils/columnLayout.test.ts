import { describe, it, expect } from 'vitest';
import { orderColumnKeys, moveColumnKey } from './columnLayout';

const BASE = ['date', 'r', 'description', 'category', 'tags', 'payment', 'deposit', 'balance'];

describe('orderColumnKeys', () => {
  it('returns the base order when nothing is saved', () => {
    expect(orderColumnKeys(BASE, [])).toEqual(BASE);
  });

  it('applies a saved order', () => {
    const saved = ['date', 'r', 'description', 'payment', 'category', 'tags', 'deposit', 'balance'];
    expect(orderColumnKeys(BASE, saved)).toEqual(saved);
  });

  it('drops unknown saved keys (e.g. a removed column) and appends new base keys', () => {
    // saved knows the old 'amount' column and is missing the new 'deposit'
    const saved = ['amount', 'date', 'description'];
    expect(orderColumnKeys(BASE, saved)).toEqual([
      'date', 'description', // known-and-saved, in saved order
      'r', 'category', 'tags', 'payment', 'deposit', 'balance' // the rest, default order
    ]);
  });
});

describe('moveColumnKey', () => {
  it('moves a key to immediately before the target', () => {
    expect(moveColumnKey(BASE, 'payment', 'category')).toEqual([
      'date', 'r', 'description', 'payment', 'category', 'tags', 'deposit', 'balance'
    ]);
  });

  it('can move a key earlier or later', () => {
    expect(moveColumnKey(BASE, 'date', 'tags')).toEqual([
      'r', 'description', 'category', 'date', 'tags', 'payment', 'deposit', 'balance'
    ]);
  });

  it('is a no-op for same key or missing keys', () => {
    expect(moveColumnKey(BASE, 'date', 'date')).toEqual(BASE);
    expect(moveColumnKey(BASE, 'nope', 'category')).toEqual(BASE);
    expect(moveColumnKey(BASE, 'date', 'nope')).toEqual(BASE);
  });

  it('does not mutate the input array', () => {
    const input = [...BASE];
    moveColumnKey(input, 'payment', 'date');
    expect(input).toEqual(BASE);
  });
});
