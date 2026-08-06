/**
 * The duplicate sweep's two rules: one account at a time, and never offer to
 * delete a row that is holding something else together.
 *
 * The scoring itself belongs to duplicateScan and is tested there; what is
 * pinned here is the part that makes a delete tool safe to point at real money.
 */

import { describe, it, expect } from 'vitest';
import { deleteBlockOf, findDuplicateCandidates } from './duplicateSweep';
import type { Transaction } from '../types';

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -49.99,
  description: 'TESCO STORES 3421',
  category: 'cat-food',
  accountId: 'acc-current',
  type: 'expense',
  ...over,
});

const keysOf = (candidates: ReturnType<typeof findDuplicateCandidates>): string[] =>
  candidates.map(c => [c.a.id, c.b.id].sort().join('+')).sort();

describe('findDuplicateCandidates', () => {
  it('finds the same payment recorded twice in one account', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'feed' }), txn({ id: 'import' })],
      { windowDays: 3 }
    );
    expect(keysOf(found)).toEqual(['feed+import']);
    expect(found[0].score).toBeGreaterThanOrEqual(80);
    expect(found[0].daysApart).toBe(0);
  });

  it('never pairs rows in DIFFERENT accounts — that is a transfer, not a duplicate', () => {
    // Equal and opposite would be the transfer sweep's business; equal and
    // IDENTICAL across two accounts is still not one payment recorded twice.
    const found = findDuplicateCandidates(
      [txn({ id: 'here' }), txn({ id: 'there', accountId: 'acc-joint' })],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('respects the date window', () => {
    const rows = [txn({ id: 'first' }), txn({ id: 'later', date: new Date('2026-05-09') })];
    expect(findDuplicateCandidates(rows, { windowDays: 3 })).toEqual([]);
    expect(keysOf(findDuplicateCandidates(rows, { windowDays: 14 }))).toEqual(['first+later']);
  });

  it('leaves amounts that differ by real money alone', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'a', amount: -49.99 }), txn({ id: 'b', amount: -149.99 })],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('ignores archived rows — they are out of the register by choice', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'live' }), txn({ id: 'put-away', archived: true })],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('offers a three-way duplicate as pairs, each with both of its rows', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'one' }), txn({ id: 'two' }), txn({ id: 'three' })],
      { windowDays: 3 }
    );
    expect(keysOf(found)).toEqual(['one+three', 'one+two']);
  });
});

describe('deleteBlockOf', () => {
  it('lets an ordinary row go', () => {
    expect(deleteBlockOf(txn({ id: 'plain' }))).toBeNull();
  });

  it('refuses half of a linked transfer — the other side would be stranded', () => {
    expect(deleteBlockOf(txn({
      id: 'leg', type: 'transfer', linkedTransferId: 'other-leg', transferAccountId: 'acc-joint',
    }))).toBe('linked-transfer');
  });

  it('refuses the counterpart of a split LINE, and says so precisely', () => {
    // This row carries BOTH pointers (linkedTransferId names the split parent),
    // and the split-line reason is the one that tells the user what to do.
    expect(deleteBlockOf(txn({
      id: 'line-counterpart', type: 'transfer',
      linkedTransferId: 'split-parent', linkedTransferSplitId: 'line-1',
    }))).toBe('split-line-counterpart');
  });

  it('refuses a split parent — its lines, and any leg among them, go with it', () => {
    expect(deleteBlockOf(txn({ id: 'parent', isSplit: true }))).toBe('split-parent');
  });
});
