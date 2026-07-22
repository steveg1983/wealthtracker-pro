import { describe, it, expect } from 'vitest';
import { findFeedOverlap, descriptionSimilarity, type ExistingFeedTransaction } from './feedOverlap';
import type { Transaction } from '../../../types';

// All data here is invented. The shapes mirror what transformMsMoneyExport
// emits and what a bank feed writes; the values are made up.

const txn = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'amount'>): Transaction => ({
  date: new Date('2026-05-10T00:00:00.000Z'),
  description: 'Corner Shop',
  accountId: 'mny-acct-1',
  type: 'expense',
  category: 'mny-cat-1',
  cleared: false,
  ...over,
} as Transaction);

const feed = (over: Partial<ExistingFeedTransaction> & Pick<ExistingFeedTransaction, 'id' | 'amount'>): ExistingFeedTransaction => ({
  accountId: 'mny-acct-1',
  date: '2026-05-10',
  description: 'CORNER SHOP LTD 4471',
  ...over,
});

describe('descriptionSimilarity', () => {
  it('scores shared words, ignores case/punctuation, and returns 0 for nothing in common', () => {
    expect(descriptionSimilarity('Corner Shop', 'CORNER SHOP LTD')).toBeGreaterThan(0.5);
    expect(descriptionSimilarity('Corner Shop', 'Fuel Station')).toBe(0);
    // Short tokens are noise and are dropped, so an all-short string scores 0.
    expect(descriptionSimilarity('a b c', 'a b c')).toBe(0);
  });
});

describe('findFeedOverlap', () => {
  it('matches same account + exact pence + same day', () => {
    const result = findFeedOverlap(
      [txn({ id: 'mny-txn-1', amount: -12.34 })],
      [feed({ id: 'feed-1', amount: -12.34 })]
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      importSourceId: 'mny-txn-1', feedTransactionId: 'feed-1', dayGap: 0,
    });
    expect(result.suppressedSourceIds.has('mny-txn-1')).toBe(true);
    expect(result.unmatchedFeedIds).toEqual([]);
  });

  it('tolerates a settlement-date shift but not an arbitrary one', () => {
    const money = [txn({ id: 'mny-txn-1', amount: -50, date: new Date('2026-05-10T00:00:00.000Z') })];
    const within = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -50, date: '2026-05-12' })]);
    expect(within.matches).toHaveLength(1);
    expect(within.matches[0].dayGap).toBe(2);

    const beyond = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -50, date: '2026-05-20' })]);
    expect(beyond.matches).toEqual([]);
    expect(beyond.unmatchedFeedIds).toEqual(['feed-1']);
  });

  it('never matches across accounts or across a penny difference', () => {
    const money = [txn({ id: 'mny-txn-1', amount: -12.34 })];
    expect(findFeedOverlap(money, [feed({ id: 'f', amount: -12.34, accountId: 'mny-acct-9' })]).matches).toEqual([]);
    expect(findFeedOverlap(money, [feed({ id: 'f', amount: -12.35 })]).matches).toEqual([]);
  });

  it('matches 1:1 — two feed rows never claim the same Money row', () => {
    const money = [txn({ id: 'mny-txn-1', amount: -9.99 })];
    const result = findFeedOverlap(money, [
      feed({ id: 'feed-1', amount: -9.99 }),
      feed({ id: 'feed-2', amount: -9.99 }),
    ]);
    // One is a duplicate of the imported row; the other is spending the Money
    // file never had, and survives.
    expect(result.matches).toHaveLength(1);
    expect(result.unmatchedFeedIds).toEqual(['feed-2']);
  });

  it('pairs repeated same-amount rows off rather than collapsing them', () => {
    const money = [
      txn({ id: 'mny-txn-1', amount: -7.99, date: new Date('2026-05-10T00:00:00.000Z') }),
      txn({ id: 'mny-txn-2', amount: -7.99, date: new Date('2026-05-10T00:00:00.000Z') }),
      txn({ id: 'mny-txn-3', amount: -7.99, date: new Date('2026-05-10T00:00:00.000Z') }),
    ];
    const result = findFeedOverlap(money, [
      feed({ id: 'feed-1', amount: -7.99 }),
      feed({ id: 'feed-2', amount: -7.99 }),
    ]);
    expect(result.matches).toHaveLength(2);
    expect(new Set(result.matches.map(m => m.importSourceId)).size).toBe(2);
    // The third genuine copy is still imported.
    expect(result.suppressedSourceIds.size).toBe(2);
  });

  it('prefers the nearest date, then the closest description', () => {
    const money = [
      txn({ id: 'mny-txn-far', amount: -20, date: new Date('2026-05-08T00:00:00.000Z'), description: 'Corner Shop' }),
      txn({ id: 'mny-txn-near', amount: -20, date: new Date('2026-05-10T00:00:00.000Z'), description: 'Fuel Station' }),
    ];
    const byDate = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -20, date: '2026-05-10' })]);
    expect(byDate.matches[0].importSourceId).toBe('mny-txn-near');

    const sameDay = [
      txn({ id: 'mny-txn-a', amount: -20, description: 'Fuel Station' }),
      txn({ id: 'mny-txn-b', amount: -20, description: 'Corner Shop' }),
    ];
    const byDescription = findFeedOverlap(sameDay, [feed({ id: 'feed-1', amount: -20 })]);
    expect(byDescription.matches[0].importSourceId).toBe('mny-txn-b');
  });

  it('never suppresses a transfer leg, and reports the overlap it left alone', () => {
    const money = [
      txn({ id: 'mny-txn-1', amount: -500, type: 'transfer', transferAccountId: 'mny-acct-2', linkedTransferId: 'mny-txn-2' }),
    ];
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -500, description: 'TRANSFER' })]);
    expect(result.suppressedSourceIds.size).toBe(0);
    expect(result.keptDespiteOverlap.transfers).toBe(1);
    expect(result.unmatchedFeedIds).toEqual(['feed-1']);
  });

  it('never suppresses a split parent (its lines would be orphaned)', () => {
    const money = [txn({ id: 'mny-txn-1', amount: -80, isSplit: true, category: '' })];
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -80 })]);
    expect(result.suppressedSourceIds.size).toBe(0);
    expect(result.keptDespiteOverlap.splitParents).toBe(1);
  });

  it('leaves everything outside the feed window untouched', () => {
    const money = [
      txn({ id: 'mny-txn-old', amount: -30, date: new Date('2015-01-01T00:00:00.000Z') }),
      txn({ id: 'mny-txn-new', amount: -30, date: new Date('2026-05-10T00:00:00.000Z') }),
    ];
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -30, date: '2026-05-10' })]);
    expect([...result.suppressedSourceIds]).toEqual(['mny-txn-new']);
  });

  it('handles an empty feed as a plain no-op', () => {
    const result = findFeedOverlap([txn({ id: 'mny-txn-1', amount: -1 })], []);
    expect(result.matches).toEqual([]);
    expect(result.suppressedSourceIds.size).toBe(0);
    expect(result.unmatchedFeedIds).toEqual([]);
  });

  it('uses exact pence, so no float drift can slip a match through', () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004; both sides must land on 30p.
    const money = [txn({ id: 'mny-txn-1', amount: 0.1 + 0.2 })];
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: '0.30' })]);
    expect(result.matches).toHaveLength(1);
  });
});
