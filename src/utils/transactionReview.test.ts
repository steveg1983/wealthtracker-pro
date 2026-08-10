/**
 * The one rule the whole review flow reads from — and its load-bearing
 * asymmetry.
 *
 * `needsReview === true` means new. Everything else means reviewed, including
 * `undefined`, which is what a database without migration 20260810090000
 * returns and what the local/demo store holds. Getting that backwards would
 * print the owner's entire fifty-one thousand row history in bold on the day of
 * the deploy, so it is pinned here rather than left to the four surfaces that
 * ask (the register's bold, its counter, its filter and the Accounts column).
 *
 * Every figure below is invented: this repo is public.
 */

import { describe, it, expect } from 'vitest';
import {
  countAwaitingReview,
  countAwaitingReviewByAccount,
  isAwaitingReview,
} from './transactionReview';
import type { Transaction } from '../types';

const row = (id: string, rest: Partial<Transaction> = {}): Transaction => ({
  id,
  accountId: 'acc-a',
  amount: -12.34,
  date: new Date('2026-05-01'),
  description: 'Synthetic row',
  category: 'det-sundries',
  type: 'expense',
  ...rest,
});

describe('isAwaitingReview', () => {
  it('says yes only to a row explicitly marked new', () => {
    expect(isAwaitingReview(row('a', { needsReview: true }))).toBe(true);
  });

  it('says no to a row that has been reviewed', () => {
    expect(isAwaitingReview(row('a', { needsReview: false }))).toBe(false);
  });

  it('says no to a row carrying no flag at all', () => {
    // THE asymmetry. A database without the migration returns no such key, and
    // the local/demo store never sets one. Reading that as "new" would light up
    // every transaction the user has ever owned.
    expect(isAwaitingReview(row('a'))).toBe(false);
  });
});

describe('countAwaitingReview', () => {
  it('counts the new ones and nothing else', () => {
    expect(countAwaitingReview([
      row('a', { needsReview: true }),
      row('b', { needsReview: false }),
      row('c'),
      row('d', { needsReview: true }),
    ])).toBe(4 - 2);
  });

  it('is zero for an empty list', () => {
    expect(countAwaitingReview([])).toBe(0);
  });
});

describe('countAwaitingReviewByAccount', () => {
  it('rolls the new rows up to the account they belong to', () => {
    const counts = countAwaitingReviewByAccount([
      row('a', { accountId: 'acc-a', needsReview: true }),
      row('b', { accountId: 'acc-a', needsReview: true }),
      row('c', { accountId: 'acc-a', needsReview: false }),
      row('d', { accountId: 'acc-b', needsReview: true }),
      row('e', { accountId: 'acc-c' }),
    ]);

    expect(counts.get('acc-a')).toBe(2);
    expect(counts.get('acc-b')).toBe(1);
  });

  it('leaves an account with nothing waiting out of the map entirely', () => {
    // Absent rather than zero, so the caller decides what "none" looks like:
    // the Accounts column draws a quiet 0 beside its neighbours, the register's
    // counter draws nothing at all.
    const counts = countAwaitingReviewByAccount([
      row('a', { accountId: 'acc-a', needsReview: false }),
      row('b', { accountId: 'acc-b' }),
    ]);

    expect(counts.has('acc-a')).toBe(false);
    expect(counts.has('acc-b')).toBe(false);
    expect(counts.size).toBe(0);
  });
});
