/**
 * The one rule the whole review flow reads from — both arms of it.
 *
 * Arm one, the flag: `needsReview === true` means new, and everything else —
 * false, undefined, missing — means reviewed, including what a database
 * without migration 20260810090000 returns and what the local/demo store
 * holds. Getting that backwards would print the owner's entire fifty-one
 * thousand row history in bold on the day of the deploy.
 *
 * Arm two, unfiled (the owner's ruling of 29 August 2026): a row without a
 * category awaits review however it arrived and however old it is — with
 * transfers excluded (a transfer takes no category) and split parents excluded
 * (their filing lives in their lines, which belong to the categorise rung).
 * The bold-flood guard was re-measured before this arm shipped: ten unfiled
 * rows in fifty-one thousand, every one already flagged.
 *
 * Pinned here rather than left to the five surfaces that ask (the register's
 * bold, its counter, its filter, the Accounts column and the attention
 * ladder's review rung).
 *
 * Every figure below is invented: this repo is public.
 */

import { describe, it, expect } from 'vitest';
import {
  awaitsFiling,
  countAwaitingReview,
  countAwaitingReviewByAccount,
  isAwaitingReview,
  isUnfiled,
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

describe('isAwaitingReview — the flag arm', () => {
  it('says yes to a row explicitly marked new', () => {
    expect(isAwaitingReview(row('a', { needsReview: true }))).toBe(true);
  });

  it('says no to a reviewed, filed row', () => {
    expect(isAwaitingReview(row('a', { needsReview: false }))).toBe(false);
  });

  it('says no to a filed row carrying no flag at all', () => {
    // THE asymmetry. A database without the migration returns no such key, and
    // the local/demo store never sets one. Reading that as "new" would light up
    // every transaction the user has ever owned.
    expect(isAwaitingReview(row('a'))).toBe(false);
  });

  it('keeps a flagged row flagged even when it arrived categorised', () => {
    // A rule or payee memory filing a fed row does not review it: review is
    // about the row, not the category (20260829120000's whole argument).
    expect(isAwaitingReview(row('a', { needsReview: true, category: 'det-groceries' }))).toBe(true);
  });
});

describe('isAwaitingReview — the unfiled arm (owner, 29 Aug 2026)', () => {
  it('flags a row with no category, however it arrived', () => {
    // "Whether the info was injected via bank connection or manually" — a
    // hand-typed quick-add with no category and no flag still wants eyes.
    expect(isAwaitingReview(row('a', { category: undefined }))).toBe(true);
  });

  it('flags an empty-string category as unfiled, not filed-as-nothing', () => {
    expect(isAwaitingReview(row('a', { category: '' }))).toBe(true);
    expect(isAwaitingReview(row('a', { category: '   ' }))).toBe(true);
  });

  it('never flags a transfer — moving your own money takes no category', () => {
    expect(isAwaitingReview(row('a', { type: 'transfer', category: undefined }))).toBe(false);
  });

  it('never flags a split parent — its filing lives in its lines', () => {
    expect(isAwaitingReview(row('a', { isSplit: true, category: undefined }))).toBe(false);
  });

  it('saving without filing keeps the row flagged, deliberately', () => {
    // The editor's save clears the flag; the unfiled arm is what stops that
    // save from quietly parking uncategorised money as "done".
    expect(isAwaitingReview(row('a', { needsReview: false, category: undefined }))).toBe(true);
  });

  it('treats a category id it cannot see as filed — dangling ids are data health, not review', () => {
    // The predicate is row-local by design: it cannot know whether an id
    // dangles, and "your filing broke" belongs to categoryHealth. Any
    // non-blank string reads as filed here.
    expect(isAwaitingReview(row('a', { category: 'det-deleted-long-ago' }))).toBe(false);
  });
});

describe('isUnfiled — exported for the ladder, so subtraction cannot drift', () => {
  it('is exactly the unfiled arm, without the flag', () => {
    expect(isUnfiled(row('a', { category: undefined }))).toBe(true);
    expect(isUnfiled(row('a', { needsReview: true }))).toBe(false);
    expect(isUnfiled(row('a', { type: 'transfer', category: undefined }))).toBe(false);
    expect(isUnfiled(row('a', { isSplit: true, category: undefined }))).toBe(false);
  });
});

describe('awaitsFiling — what a bulk filing surface may offer', () => {
  it('takes both arms, exactly as the register bolds them', () => {
    expect(awaitsFiling(row('a', { needsReview: true, category: 'det-groceries' }))).toBe(true);
    expect(awaitsFiling(row('b', { category: '' }))).toBe(true);
    expect(awaitsFiling(row('c'))).toBe(false);
  });

  it('refuses a flagged transfer, which the register bolds and no filing can settle', () => {
    // The difference between this and isAwaitingReview, and the reason it
    // exists: the flag arm has no exclusions of its own, so a fed transfer
    // arrives flagged. It still wants a look — in the transfer sweep — but a
    // category written to it is a category it does not take.
    expect(isAwaitingReview(row('a', { type: 'transfer', needsReview: true }))).toBe(true);
    expect(awaitsFiling(row('a', { type: 'transfer', needsReview: true }))).toBe(false);
  });

  it('refuses a flagged split parent, whose category the database rejects', () => {
    expect(isAwaitingReview(row('a', { isSplit: true, needsReview: true }))).toBe(true);
    expect(awaitsFiling(row('a', { isSplit: true, needsReview: true }))).toBe(false);
  });
});

describe('countAwaitingReview', () => {
  it('counts both arms and nothing else', () => {
    expect(countAwaitingReview([
      row('a', { needsReview: true }),
      row('b', { needsReview: false }),
      row('c'),
      row('d', { needsReview: true }),
      row('e', { category: undefined }),
      row('f', { type: 'transfer', category: undefined }),
    ])).toBe(3);
  });

  it('counts a row once when both arms apply', () => {
    expect(countAwaitingReview([
      row('a', { needsReview: true, category: undefined }),
    ])).toBe(1);
  });

  it('is zero for an empty list', () => {
    expect(countAwaitingReview([])).toBe(0);
  });
});

describe('countAwaitingReviewByAccount', () => {
  it('rolls waiting rows up to the account they belong to, both arms alike', () => {
    const counts = countAwaitingReviewByAccount([
      row('a', { accountId: 'acc-a', needsReview: true }),
      row('b', { accountId: 'acc-a', needsReview: true }),
      row('c', { accountId: 'acc-a', needsReview: false }),
      row('d', { accountId: 'acc-b', needsReview: true }),
      row('e', { accountId: 'acc-c' }),
      row('f', { accountId: 'acc-b', category: undefined }),
    ]);

    expect(counts.get('acc-a')).toBe(2);
    expect(counts.get('acc-b')).toBe(2);
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
