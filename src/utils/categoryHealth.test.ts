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

  it('transfer-type rows never inflate the uncategorised total', () => {
    const health = computeCategoryHealth(
      [txn({ id: 't1', category: '', type: 'transfer', amount: -500 })],
      [],
      CATEGORIES
    );
    expect(health.uncategorizedCount).toBe(0);
  });
});
