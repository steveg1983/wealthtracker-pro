import { describe, it, expect } from 'vitest';
import { computeCategoryHealth } from './categoryHealth';
import type { Category, Transaction, TransactionSplit } from '../types';

// Synthetic tree: two real detail categories, the importer's bucket, plus the
// system containers/categories empty-detection must ignore.
const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'type-income' },
  { id: 'cat-empty', name: 'Never Used', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: 'cat-unassigned', name: 'Unassigned', type: 'both', level: 'detail', parentId: 'type-expense', isUnassignedBucket: true },
  { id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'detail', parentId: 'type-transfer', isTransferCategory: true },
  { id: 'cat-reval', name: 'Market Value Change', type: 'both', level: 'detail', isRevaluationCategory: true },
  { id: 'cat-inactive', name: 'Closed', type: 'expense', level: 'detail', parentId: 'sub-food', isActive: false },
];

const txn = (over: Partial<Transaction>): Transaction => ({
  id: 't1',
  date: new Date('2026-07-10'),
  amount: -10,
  description: 'x',
  category: '',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

const split = (over: Partial<TransactionSplit>): TransactionSplit => ({
  id: 's1',
  transactionId: 'p1',
  category: '',
  amount: -10,
  sortOrder: 0,
  ...over,
});

describe('computeCategoryHealth', () => {
  it('all-clean data → every count zero and hasWarnings false (panel renders nothing)', () => {
    const health = computeCategoryHealth(
      [
        txn({ id: 't1', category: 'cat-groceries', amount: -30 }),
        txn({ id: 't2', category: 'cat-salary', amount: 1200, type: 'income' }),
      ],
      [],
      // Only categories that ARE used — no empty leaves, no bucket, no dangling.
      [
        { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail' },
        { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail' },
      ]
    );
    expect(health).toMatchObject({
      uncategorizedCount: 0,
      unassignedBucketCount: 0,
      danglingCount: 0,
      emptyCategoryCount: 0,
      hasWarnings: false,
    });
  });

  it('a bucket row is counted in BOTH the uncategorised total and the bucket line', () => {
    const health = computeCategoryHealth(
      [txn({ id: 't1', category: 'cat-unassigned', type: 'income', amount: 5000 })],
      [],
      CATEGORIES
    );
    expect(health.uncategorizedCount).toBe(1);
    expect(health.unassignedBucketCount).toBe(1);
    // The line's REMEDY needs to know which bucket to open, not just how many.
    expect(health.unassignedBucketCategoryId).toBe('cat-unassigned');
    expect(health.danglingCount).toBe(0);
    // Money in reflects the review-band sums (in for a positive amount).
    expect(health.uncategorizedIn).toBe(5000);
    expect(health.uncategorizedOut).toBe(0);
    expect(health.hasWarnings).toBe(true);
  });

  it('a dangling category id is counted in BOTH the uncategorised total and the dangling line', () => {
    const health = computeCategoryHealth(
      [txn({ id: 't1', category: 'was-deleted', amount: -42 })],
      [],
      CATEGORIES
    );
    expect(health.uncategorizedCount).toBe(1);
    expect(health.danglingCount).toBe(1);
    expect(health.unassignedBucketCount).toBe(0);
    // A negative amount is money OUT.
    expect(health.uncategorizedOut).toBe(42);
    expect(health.uncategorizedIn).toBe(0);
  });

  it('split lines are counted per line — a bucket line and a dangling line inside one parent', () => {
    const parent = txn({ id: 'p1', category: '', amount: -100, isSplit: true });
    const splits: TransactionSplit[] = [
      split({ id: 's1', transactionId: 'p1', category: 'cat-unassigned', amount: -60, sortOrder: 0 }),
      split({ id: 's2', transactionId: 'p1', category: 'was-deleted', amount: -40, sortOrder: 1 }),
    ];
    const health = computeCategoryHealth([parent], splits, CATEGORIES);
    // Two lines, both uncategorised; one bucket, one dangling.
    expect(health.uncategorizedCount).toBe(2);
    expect(health.unassignedBucketCount).toBe(1);
    expect(health.danglingCount).toBe(1);
    expect(health.uncategorizedOut).toBe(100);
  });

  it('empty-category detection flags only unused DETAIL leaves', () => {
    const health = computeCategoryHealth(
      [txn({ id: 't1', category: 'cat-groceries', amount: -30 })],
      [],
      CATEGORIES
    );
    // cat-empty is the one unused, active, non-system detail leaf. cat-groceries
    // is used; cat-salary is unused but likewise a normal leaf → also flagged.
    expect(health.emptyCategoryCount).toBe(2);
    expect(health.hasWarnings).toBe(true);
  });

  it('empty-category detection ignores type/sub levels and system categories', () => {
    // Everything present but NOTHING filed anywhere: only the two normal detail
    // leaves (cat-groceries, cat-empty, cat-salary) count — NOT the type/sub
    // containers, the bucket, the transfer/revaluation categories, or inactive.
    const health = computeCategoryHealth([], [], CATEGORIES);
    // cat-groceries, cat-salary, cat-empty = 3 normal detail leaves, all unused.
    expect(health.emptyCategoryCount).toBe(3);
    // Sanity: the excluded ones are genuinely in the fixture.
    expect(CATEGORIES.some(c => c.isUnassignedBucket)).toBe(true);
    expect(CATEGORIES.some(c => c.isTransferCategory)).toBe(true);
    expect(CATEGORIES.some(c => c.isRevaluationCategory)).toBe(true);
    expect(CATEGORIES.some(c => c.level === 'sub')).toBe(true);
    expect(CATEGORIES.some(c => c.isActive === false)).toBe(true);
  });

  it('a category used only inside a split line is NOT empty', () => {
    const parent = txn({ id: 'p1', category: '', amount: -50, isSplit: true });
    const splits: TransactionSplit[] = [
      split({ id: 's1', transactionId: 'p1', category: 'cat-empty', amount: -20, sortOrder: 0 }),
      split({ id: 's2', transactionId: 'p1', category: 'cat-groceries', amount: -30, sortOrder: 1 }),
    ];
    const health = computeCategoryHealth([parent], splits, CATEGORIES);
    // cat-empty now has a split line → only cat-salary remains unused.
    expect(health.emptyCategoryCount).toBe(1);
  });

  /**
   * Every measure carries what its remedy needs to ACT — which bucket, which
   * categories — because a warning the user cannot act on from where they read
   * it is a complaint (see CategoryDataHealthPanel).
   */
  describe('each measure carries what its remedy needs', () => {
    it('names the empty categories, and the count is that list’s length', () => {
      const health = computeCategoryHealth(
        [txn({ id: 't1', category: 'cat-groceries', amount: -30 })],
        [],
        CATEGORIES
      );
      expect(health.emptyCategoryIds).toEqual(['cat-salary', 'cat-empty']);
      // The number the user reads and the rows that light up cannot disagree.
      expect(health.emptyCategoryCount).toBe(health.emptyCategoryIds.length);
    });

    it('names no bucket and no categories when there is nothing to point at', () => {
      const health = computeCategoryHealth(
        [txn({ id: 't1', category: 'cat-groceries', amount: -30 })],
        [],
        [{ id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail' }]
      );
      expect(health.unassignedBucketCategoryId).toBeNull();
      expect(health.emptyCategoryIds).toEqual([]);
    });

    it('a bucket id is present whenever the bucket count is — the promise the panel relies on', () => {
      const parent = txn({ id: 'p1', category: '', amount: -100, isSplit: true });
      const health = computeCategoryHealth(
        [parent],
        [split({ id: 's1', transactionId: 'p1', category: 'cat-unassigned', amount: -100, sortOrder: 0 })],
        CATEGORIES
      );
      expect(health.unassignedBucketCount).toBeGreaterThan(0);
      expect(health.unassignedBucketCategoryId).not.toBeNull();
    });

    it('with two buckets, points at the one holding the most rows', () => {
      // Not the case today (one importer, one bucket) — pinned so a second
      // importer's bucket cannot silently send the user to the emptier list.
      const withSecondBucket: Category[] = [
        ...CATEGORIES,
        { id: 'cat-unassigned-2', name: 'Unassigned (other)', type: 'both', level: 'detail', isUnassignedBucket: true },
      ];
      const health = computeCategoryHealth(
        [
          txn({ id: 't1', category: 'cat-unassigned-2', amount: -10 }),
          txn({ id: 't2', category: 'cat-unassigned', amount: -10 }),
          txn({ id: 't3', category: 'cat-unassigned', amount: -10 }),
        ],
        [],
        withSecondBucket
      );
      expect(health.unassignedBucketCount).toBe(3);
      expect(health.unassignedBucketCategoryId).toBe('cat-unassigned');
    });
  });

  it('transfer-type rows never inflate the uncategorised total', () => {
    const health = computeCategoryHealth(
      [txn({ id: 't1', category: '', type: 'transfer', amount: -500 })],
      [],
      CATEGORIES
    );
    expect(health.uncategorizedCount).toBe(0);
  });

  /**
   * The fifth measure: a transfer category on a row that is not a transfer.
   *
   * Its consequence is the reason it is on the panel at all — such a row is
   * counted as a transfer by `classifyFlow`, so it lands in NEITHER total and
   * NOT in the uncategorised band either. It is invisible everywhere except the
   * balance it moves, which is precisely why nothing else would ever surface it.
   */
  describe('transfer categories with no other side', () => {
    it('counts a row typed expense but filed as a transfer, and names it', () => {
      const health = computeCategoryHealth(
        [txn({ id: 't-mismatch', category: 'tofrom-savings', amount: -200 })],
        [],
        CATEGORIES
      );
      expect(health.transferFilingMismatchCount).toBe(1);
      expect(health.transferFilingMismatchIds).toEqual(['t-mismatch']);
      expect(health.hasWarnings).toBe(true);
    });

    it('is invisible to the other four measures — which is the problem', () => {
      const health = computeCategoryHealth(
        [txn({ id: 't-mismatch', category: 'tofrom-savings', amount: -200 })],
        [],
        CATEGORIES
      );
      // Not uncategorised (it has a real category id), not a bucket row, not
      // dangling. Without this measure the row is named by nothing at all.
      expect(health.uncategorizedCount).toBe(0);
      expect(health.unassignedBucketCount).toBe(0);
      expect(health.danglingCount).toBe(0);
    });

    it('leaves real transfers and linked rows alone', () => {
      const health = computeCategoryHealth(
        [
          txn({ id: 't-real', category: 'tofrom-savings', type: 'transfer', amount: -200 }),
          txn({ id: 't-linked', category: 'tofrom-savings', amount: -200, linkedTransferId: 't-other' }),
        ],
        [],
        CATEGORIES
      );
      expect(health.transferFilingMismatchCount).toBe(0);
    });

    it('never counts a split transfer LEG — a legitimate Money construct', () => {
      // The expansion gives every split line an income/expense type from its
      // sign, so measuring this on expanded rows would report each legitimate
      // leg as broken. This measure reads the stored transactions instead.
      const parent = txn({ id: 'p1', category: '', amount: -100, isSplit: true });
      const health = computeCategoryHealth(
        [parent],
        [
          split({ id: 's1', transactionId: 'p1', category: 'tofrom-savings', amount: -60, sortOrder: 0 }),
          split({ id: 's2', transactionId: 'p1', category: 'cat-groceries', amount: -40, sortOrder: 1 }),
        ],
        CATEGORIES
      );
      expect(health.transferFilingMismatchCount).toBe(0);
    });

    it('is zero on clean data, so the line renders nothing', () => {
      const health = computeCategoryHealth(
        [txn({ id: 't1', category: 'cat-groceries', amount: -30 })],
        [],
        [{ id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail' }]
      );
      expect(health.transferFilingMismatchCount).toBe(0);
      expect(health.transferFilingMismatchIds).toEqual([]);
      expect(health.hasWarnings).toBe(false);
    });
  });
});

describe('computeCategoryHealth — the flows seam (Design §5, 25 Aug)', () => {
  // Every figure below is invented; this repo is public. The factor 2 is
  // chosen because it makes a wrong basis visible at a glance rather than
  // plausible — a real rate never would.
  const FOREIGN = txn({ id: 't1', category: '', type: 'income', amount: 100, accountId: 'acc-usd' });

  it('the money figures convert when a resolver hands back a factor', () => {
    const health = computeCategoryHealth([FOREIGN], [], CATEGORIES, {
      convert: row => (row.accountId === 'acc-usd' ? 2 : null),
    });
    expect(health.uncategorizedIn).toBe(200);
    expect(health.uncategorizedCount).toBe(1);
  });

  it('holdsForeign gates the ≈: true only when a factor was actually applied', () => {
    const converted = computeCategoryHealth([FOREIGN], [], CATEGORIES, {
      convert: row => (row.accountId === 'acc-usd' ? 2 : null),
    });
    expect(converted.holdsForeign).toBe(true);

    // A resolver that declines every row is the single-currency case: nothing
    // converted, so nothing may wear the mark.
    const declined = computeCategoryHealth([FOREIGN], [], CATEGORIES, { convert: () => null });
    expect(declined.holdsForeign).toBe(false);
    expect(declined.uncategorizedIn).toBe(100);
  });

  it('no resolver → native, and the mark stays off (the degraded path)', () => {
    // Not a defect: with no ECB history the seam declines to convert, and the
    // caller's basis line falls back to saying the totals are native. The one
    // state the ruling forbids is converting on a basis nobody stated.
    const health = computeCategoryHealth([FOREIGN], [], CATEGORIES);
    expect(health.uncategorizedIn).toBe(100);
    expect(health.holdsForeign).toBe(false);
  });

  it('a row the resolver has no factor for stays native and does not fake the mark', () => {
    // THE CLOSED-ACCOUNT CASE, which is why both callers build their resolver
    // from useHistoricalAccounts: 43 of the 90 accounts behind the real
    // backlog are closed, and a resolver built from open accounts alone would
    // return null for exactly those rows.
    const health = computeCategoryHealth(
      [FOREIGN, txn({ id: 't2', category: '', type: 'income', amount: 50, accountId: 'acc-closed' })],
      [],
      CATEGORIES,
      { convert: row => (row.accountId === 'acc-usd' ? 2 : null) }
    );
    // 200 converted + 50 left native — the arithmetic the ≈ is admitting to.
    expect(health.uncategorizedIn).toBe(250);
    expect(health.holdsForeign).toBe(true);
  });
});
