import { describe, it, expect } from 'vitest';
import {
  sumSplitDrafts,
  splitRemainder,
  validateSplitDrafts,
  signSplitAmounts,
  displaySplitAmount,
  expandSplitTransactions,
  splitsByTransaction,
  type SplitLineDraft,
} from './transactionSplits';
import type { Transaction, TransactionSplit } from '../types';

const line = (category: string, amount: string): SplitLineDraft => ({ category, amount });

describe('sumSplitDrafts / splitRemainder', () => {
  it('sums entered amounts exactly (no float drift)', () => {
    // 0.1 + 0.2 is the classic float trap; Decimal must make it exactly 0.3
    const lines = [line('a', '0.1'), line('b', '0.2')];
    expect(sumSplitDrafts(lines).toString()).toBe('0.3');
    expect(splitRemainder('0.3', lines).isZero()).toBe(true);
  });

  it('treats blank or invalid amounts as 0', () => {
    const lines = [line('a', '10'), line('b', ''), line('c', 'abc')];
    expect(sumSplitDrafts(lines).toString()).toBe('10');
  });

  it('handles negative lines (cashback inside a shop)', () => {
    const lines = [line('groceries', '120'), line('cashback', '-20')];
    expect(sumSplitDrafts(lines).toString()).toBe('100');
    expect(splitRemainder('100', lines).isZero()).toBe(true);
  });

  it('reports what is left to allocate', () => {
    expect(splitRemainder('100', [line('a', '60')]).toString()).toBe('40');
    expect(splitRemainder('100', [line('a', '60'), line('b', '55')]).toString()).toBe('-15');
  });

  it('accepts formatted input with currency symbols and commas', () => {
    expect(splitRemainder('1,250.00', [line('a', '£1,000'), line('b', '250')]).isZero()).toBe(true);
  });
});

describe('validateSplitDrafts', () => {
  it('requires at least two lines', () => {
    expect(validateSplitDrafts('100', [line('a', '100')])).toMatch(/at least two/);
  });

  it('requires a category on every line', () => {
    expect(validateSplitDrafts('100', [line('a', '60'), line('', '40')])).toMatch(/needs a category/);
  });

  it('requires a non-zero amount on every line', () => {
    expect(validateSplitDrafts('100', [line('a', '100'), line('b', '')])).toMatch(/non-zero amount/);
    expect(validateSplitDrafts('100', [line('a', '100'), line('b', '0')])).toMatch(/non-zero amount/);
  });

  it('blocks a save when the totals do not match', () => {
    expect(validateSplitDrafts('100', [line('a', '60'), line('b', '30')])).toMatch(/must match/);
  });

  it('returns null for a balanced split', () => {
    expect(validateSplitDrafts('100', [line('a', '60'), line('b', '40')])).toBeNull();
    expect(validateSplitDrafts('100', [line('a', '120'), line('b', '-20')])).toBeNull();
  });
});

describe('signSplitAmounts', () => {
  it('negates expense lines to the DB convention', () => {
    expect(signSplitAmounts([line('a', '120'), line('b', '-20')], 'expense')).toEqual([
      { category: 'a', amount: -120 },
      { category: 'b', amount: 20 },
    ]);
  });

  it('keeps income lines as entered', () => {
    expect(signSplitAmounts([line('a', '90'), line('b', '10')], 'income')).toEqual([
      { category: 'a', amount: 90 },
      { category: 'b', amount: 10 },
    ]);
  });

  it('never emits -0', () => {
    const [signed] = signSplitAmounts([line('a', '0')], 'expense');
    expect(Object.is(signed.amount, -0)).toBe(false);
  });

  it('passes trimmed memos through and drops blank ones', () => {
    const result = signSplitAmounts(
      [{ category: 'a', amount: '10', memo: '  petrol  ' }, { category: 'b', amount: '5', memo: '   ' }],
      'expense'
    );
    expect(result[0].memo).toBe('petrol');
    expect(result[1]).not.toHaveProperty('memo');
  });
});

describe('expandSplitTransactions', () => {
  const txn = (over: Partial<Transaction>): Transaction => ({
    id: 'x',
    date: new Date('2026-06-17'),
    description: 'TESCO STORES',
    amount: -100,
    type: 'expense',
    accountId: 'acc-1',
    category: 'cat-a',
    cleared: false,
    ...over,
  }) as Transaction;

  const split = (over: Partial<TransactionSplit>): TransactionSplit => ({
    id: 's1',
    transactionId: 't1',
    category: 'cat-a',
    amount: -60,
    sortOrder: 1,
    ...over,
  });

  it('passes non-split transactions through untouched', () => {
    const list = [txn({ id: 't1' }), txn({ id: 't2', category: 'cat-b' })];
    expect(expandSplitTransactions(list, [])).toEqual(list);
    // Splits belonging to OTHER transactions change nothing either
    expect(expandSplitTransactions(list, [split({ transactionId: 't9' })])).toEqual(list);
  });

  it('replaces a split parent with one row per line', () => {
    const parent = txn({ id: 't1', isSplit: true, category: '', amount: -100 });
    const lines = [
      split({ id: 's1', transactionId: 't1', category: 'groceries', amount: -60, sortOrder: 1 }),
      split({ id: 's2', transactionId: 't1', category: 'household', amount: -40, sortOrder: 2, memo: 'bin bags' }),
    ];
    const result = expandSplitTransactions([parent], lines);

    expect(result).toHaveLength(2);
    expect(result.map(r => r.category)).toEqual(['groceries', 'household']);
    expect(result.map(r => r.amount)).toEqual([-60, -40]);
    expect(result.every(r => r.isSplitLine && r.splitParentId === 't1')).toBe(true);
    expect(result.every(r => r.description === 'TESCO STORES')).toBe(true);
    // Synthetic ids never collide with the parent's
    expect(result.every(r => r.id !== 't1')).toBe(true);
    // A line memo travels as the row's note
    expect(result[1].notes).toBe('bin bags');
    // Line amounts sum to the parent amount (the DB invariant)
    expect(result.reduce((sum, r) => sum + r.amount, 0)).toBe(parent.amount);
  });

  it('derives the virtual row type from the line sign (cashback nets, never inflates)', () => {
    const parent = txn({ id: 't1', isSplit: true, category: '', amount: -100 });
    const lines = [
      split({ id: 's1', transactionId: 't1', category: 'groceries', amount: -120, sortOrder: 1 }),
      split({ id: 's2', transactionId: 't1', category: 'cashback', amount: 20, sortOrder: 2 }),
    ];
    const [groceries, cashback] = expandSplitTransactions([parent], lines);
    expect(groceries.type).toBe('expense');
    expect(cashback.type).toBe('income');
  });

  it('passes a split parent through whole when its lines are missing', () => {
    const parent = txn({ id: 't1', isSplit: true, category: '', amount: -100 });
    expect(expandSplitTransactions([parent], [])).toEqual([parent]);
  });

  it('orders lines by sortOrder via splitsByTransaction', () => {
    const map = splitsByTransaction([
      split({ id: 's2', sortOrder: 2 }),
      split({ id: 's1', sortOrder: 1 }),
    ]);
    expect(map.get('t1')?.map(s => s.id)).toEqual(['s1', 's2']);
  });
});

describe('displaySplitAmount', () => {
  it('round-trips with signSplitAmounts for expenses', () => {
    // stored -120 (an expense line) displays as the entered 120
    expect(displaySplitAmount(-120, 'expense')).toBe('120');
    // stored +20 (the cashback line) displays as the entered -20
    expect(displaySplitAmount(20, 'expense')).toBe('-20');
  });

  it('is identity for income', () => {
    expect(displaySplitAmount(90, 'income')).toBe('90');
  });
});
