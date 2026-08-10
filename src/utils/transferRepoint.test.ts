/**
 * The crossover rule a linked transfer is filed by, and the one thing about it
 * that is easy to get backwards: EACH SIDE'S CATEGORY NAMES THE OTHER ACCOUNT.
 *
 * These are the tests a re-point that forgot to re-file the counterpart would
 * fail — see "category consistency" below, which is the mutation target.
 */

import { describe, it, expect } from 'vitest';
import {
  planTransferRepoint,
  transferCategoryIdFor,
  transferPairIsFiledCorrectly,
} from './transferRepoint';
import type { Category, Transaction } from '../types';

const categories: Category[] = [
  { id: 'tofrom-a', name: 'To/From Current', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acc-a' } as Category,
  { id: 'tofrom-b', name: 'To/From Savings', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acc-b' } as Category,
  { id: 'tofrom-c', name: 'To/From ISA', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acc-c' } as Category,
  { id: 'det-x', name: 'Council Tax', type: 'expense', level: 'detail' } as Category,
];

/** The outgoing leg in acc-a, currently facing acc-b. */
const source = {
  id: 'src', accountId: 'acc-a', amount: -500, category: 'tofrom-b',
  transferAccountId: 'acc-b', type: 'transfer',
} as Transaction;

/** Its other half, sitting in acc-b and filed under acc-a's category. */
const counterpart = {
  id: 'cp', accountId: 'acc-b', amount: 500, category: 'tofrom-a',
  transferAccountId: 'acc-a', type: 'transfer',
} as Transaction;

describe('transferCategoryIdFor', () => {
  it('finds the account-managed To/From category', () => {
    expect(transferCategoryIdFor(categories, 'acc-b', -500)).toBe('tofrom-b');
  });

  it('falls back to the legacy sentinel, by direction, when the account has none', () => {
    // Mirrors transfer_category_for's COALESCE: a missing managed category is a
    // lifecycle bug, and it must not block a link.
    expect(transferCategoryIdFor(categories, 'acc-zzz', -500)).toBe('transfer-out');
    expect(transferCategoryIdFor(categories, 'acc-zzz', 500)).toBe('transfer-in');
  });
});

describe('planTransferRepoint — category consistency', () => {
  it('files the EDITED row under the new target account', () => {
    const filing = planTransferRepoint(source, counterpart, 'acc-c', categories);
    expect(filing.sourceCategory).toBe('tofrom-c');
    expect(filing.counterpartAccountId).toBe('acc-c');
  });

  /**
   * ─ THE MUTATION TARGET ────────────────────────────────────────────────────
   * A re-point that "only moves the counterpart's account" and leaves its
   * category alone passes every test about the row being edited and fails this
   * one — which is the point, because that is exactly the bug that leaves a row
   * filed under an account this transfer has nothing to do with.
   */
  it('files the COUNTERPART under the edited row’s account, not the target', () => {
    const filing = planTransferRepoint(source, counterpart, 'acc-c', categories);
    expect(filing.counterpartCategory).toBe('tofrom-a');
    // The mistake this catches: filing the counterpart under the target's own
    // category, which is the account it now SITS IN — a self-transfer.
    expect(filing.counterpartCategory).not.toBe('tofrom-c');
  });

  it('re-files the counterpart when the EDITED row’s own account moved', () => {
    // The case that makes deriving both sides necessary rather than tidy: the
    // full editor can move the row's account in the same save, and then the
    // counterpart's category is stale even though the target never changed.
    const moved = { ...source, accountId: 'acc-c' };
    const filing = planTransferRepoint(moved, counterpart, 'acc-b', categories);
    expect(filing.counterpartCategory).toBe('tofrom-c');
    expect(filing.sourceCategory).toBe('tofrom-b');
  });

  it('never files either side under its own account’s transfer category', () => {
    const filing = planTransferRepoint(source, counterpart, 'acc-c', categories);
    const selfFiled = categories.find(
      c => c.id === filing.counterpartCategory && c.accountId === filing.counterpartAccountId
    );
    expect(selfFiled).toBeUndefined();
  });
});

describe('transferPairIsFiledCorrectly', () => {
  it('is true for a pair that already agrees with the plan', () => {
    expect(transferPairIsFiledCorrectly(source, counterpart, 'acc-b', categories)).toBe(true);
  });

  it('is false when the target has changed', () => {
    expect(transferPairIsFiledCorrectly(source, counterpart, 'acc-c', categories)).toBe(false);
  });

  it('is false when only the counterpart’s category is stale', () => {
    const stale = { ...counterpart, category: 'tofrom-c' };
    expect(transferPairIsFiledCorrectly(source, stale, 'acc-b', categories)).toBe(false);
  });

  it('is false when only the edited row’s category is stale', () => {
    const stale = { ...source, category: 'det-x' };
    expect(transferPairIsFiledCorrectly(stale, counterpart, 'acc-b', categories)).toBe(false);
  });
});
