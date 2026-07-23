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

// ── Transfer-leg handover ────────────────────────────────────────────────────
// The shapes below are the two the real data holds: a leg whose counterpart is
// in an account the bank does NOT feed (its Money row survives and has to be
// re-pointed), and a pair where BOTH accounts are fed (each leg hands over, and
// the two feed rows end up pointing at each other). Every value is invented.

/** A transfer leg: `mny-acct-1` ⇄ `far`, linked to `counterpart`. */
const leg = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'amount'>): Transaction => txn({
  type: 'transfer',
  description: 'Card payment',
  transferAccountId: 'mny-acct-2',
  ...over,
});

describe('findFeedOverlap — transfer-leg handover', () => {
  it('suppresses a fed transfer leg and names the feed row that takes its place', () => {
    const money = [leg({ id: 'mny-txn-out', amount: -1500, linkedTransferId: 'mny-txn-in' })];
    // Nothing in common with the Money side's wording — description is a
    // ranking signal, never a gate, and the handover must not need it.
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -1500, description: 'BANK TRANSFER OUT' })]);

    expect([...result.suppressedSourceIds]).toEqual(['mny-txn-out']);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].isTransferHandover).toBe(true);
    expect(result.transferHandovers).toEqual([{
      importSourceId: 'mny-txn-out',
      feedTransactionId: 'feed-1',
      accountId: 'mny-acct-1',
      transferAccountId: 'mny-acct-2',
      counterpartSourceId: 'mny-txn-in',
      counterpartSplitSourceId: null,
      dayGap: 0,
      descriptionSimilarity: 0,
    }]);
    // The feed row is USED, so it is no longer "spending the file never had",
    // and nothing is left in the kept-despite-overlap residual.
    expect(result.unmatchedFeedIds).toEqual([]);
    expect(result.keptDespiteOverlap).toEqual({ transfers: 0, splitParents: 0 });
  });

  it('hands over BOTH legs when both accounts are fed', () => {
    const money = [
      leg({ id: 'mny-txn-out', amount: -1500, accountId: 'mny-acct-1', transferAccountId: 'mny-acct-2', linkedTransferId: 'mny-txn-in' }),
      leg({ id: 'mny-txn-in', amount: 1500, accountId: 'mny-acct-2', transferAccountId: 'mny-acct-1', linkedTransferId: 'mny-txn-out' }),
    ];
    const result = findFeedOverlap(money, [
      feed({ id: 'feed-out', amount: -1500, accountId: 'mny-acct-1' }),
      feed({ id: 'feed-in', amount: 1500, accountId: 'mny-acct-2' }),
    ]);

    expect(result.suppressedSourceIds).toEqual(new Set(['mny-txn-out', 'mny-txn-in']));
    expect(result.transferHandovers.map(h => [h.importSourceId, h.feedTransactionId, h.counterpartSourceId]))
      .toEqual([
        ['mny-txn-out', 'feed-out', 'mny-txn-in'],
        ['mny-txn-in', 'feed-in', 'mny-txn-out'],
      ]);
    expect(result.unmatchedFeedIds).toEqual([]);
  });

  it('carries the split line across when the far side is a split leg', () => {
    const money = [leg({ id: 'mny-txn-out', amount: -75, linkedTransferId: 'mny-txn-parent', linkedTransferSplitId: 'mny-split-9' })];
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -75 })]);
    expect(result.transferHandovers[0]).toMatchObject({
      counterpartSourceId: 'mny-txn-parent',
      counterpartSplitSourceId: 'mny-split-9',
    });
  });

  it('hands over a leg with no counterpart at all — there is nothing to strand', () => {
    const money = [leg({ id: 'mny-txn-out', amount: -75, linkedTransferId: undefined, transferAccountId: undefined })];
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -75 })]);
    expect(result.transferHandovers[0]).toMatchObject({
      transferAccountId: null, counterpartSourceId: null, counterpartSplitSourceId: null,
    });
  });

  it('does not widen the gate: same account, exact pence, within tolerance, or no handover', () => {
    const money = [leg({ id: 'mny-txn-out', amount: -1500, date: new Date('2026-05-10T00:00:00.000Z') })];
    const nothing = { transferHandovers: [], suppressed: 0 };
    const measure = (f: ExistingFeedTransaction) => {
      const r = findFeedOverlap(money, [f]);
      return { transferHandovers: r.transferHandovers, suppressed: r.suppressedSourceIds.size };
    };
    expect(measure(feed({ id: 'f', amount: -1500, accountId: 'mny-acct-9' }))).toEqual(nothing);
    expect(measure(feed({ id: 'f', amount: -1500.01 }))).toEqual(nothing);
    expect(measure(feed({ id: 'f', amount: -1500, date: '2026-05-20' }))).toEqual(nothing);
    // …and one that DOES qualify, so the assertions above mean something.
    expect(measure(feed({ id: 'f', amount: -1500, date: '2026-05-13' })).suppressed).toBe(1);
  });

  it('lets an ordinary row claim the feed row before any transfer leg can', () => {
    const money = [
      txn({ id: 'mny-txn-ordinary', amount: -1500, description: 'Corner Shop' }),
      leg({ id: 'mny-txn-transfer', amount: -1500 }),
    ];
    const one = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -1500 })]);
    expect([...one.suppressedSourceIds]).toEqual(['mny-txn-ordinary']);
    expect(one.transferHandovers).toEqual([]);

    // A second feed row, and the transfer leg gets one too — still strictly 1:1.
    const two = findFeedOverlap(money, [
      feed({ id: 'feed-1', amount: -1500 }),
      feed({ id: 'feed-2', amount: -1500 }),
    ]);
    expect(two.suppressedSourceIds).toEqual(new Set(['mny-txn-ordinary', 'mny-txn-transfer']));
    expect(two.transferHandovers.map(h => h.importSourceId)).toEqual(['mny-txn-transfer']);
  });

  it('is strictly 1:1 under handover — one feed row takes exactly one leg', () => {
    const money = [
      leg({ id: 'mny-txn-a', amount: -1500 }),
      leg({ id: 'mny-txn-b', amount: -1500 }),
    ];
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -1500 })]);
    expect(result.transferHandovers).toHaveLength(1);
    expect(result.suppressedSourceIds.size).toBe(1);
  });

  it('refuses the handover when the feed row could not honestly become a transfer', () => {
    const money = [leg({ id: 'mny-txn-out', amount: -1500, linkedTransferId: 'mny-txn-in' })];

    // A split feed row: the database's own trigger forbids re-typing one.
    const split = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -1500, isSplit: true })]);
    expect(split.suppressedSourceIds.size).toBe(0);
    expect(split.transferHandovers).toEqual([]);
    expect(split.keptDespiteOverlap.transfers).toBe(1);
    expect(split.unmatchedFeedIds).toEqual(['feed-1']);

    // A feed row already half of someone else's transfer.
    const linked = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -1500, linkedTransferId: 'other-row' })]);
    expect(linked.suppressedSourceIds.size).toBe(0);
    expect(linked.keptDespiteOverlap.transfers).toBe(1);
  });

  it('treats a split parent as a split parent even when it is typed transfer', () => {
    const money = [leg({ id: 'mny-txn-out', amount: -1500, isSplit: true })];
    const result = findFeedOverlap(money, [feed({ id: 'feed-1', amount: -1500 })]);
    expect(result.suppressedSourceIds.size).toBe(0);
    expect(result.keptDespiteOverlap).toEqual({ transfers: 0, splitParents: 1 });
  });
});
