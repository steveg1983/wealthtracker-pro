import { describe, it, expect } from 'vitest';
import {
  buildPeriodComparison,
  resolveComparisonRanges,
  type ResolvedComparisonRanges,
} from './periodComparison';
import { computeIncomeExpense } from './incomeExpense';
import type { Category, Transaction } from '../types';

/** Synthetic fixtures only — no real payees or amounts in this repo. */
const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-pay', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'grp-home', name: 'Home', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-power', name: 'Power', type: 'expense', level: 'detail', parentId: 'grp-home' },
];

const txn = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'date'>): Transaction => ({
  description: 'synthetic row',
  category: 'cat-power',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

const compare = (transactions: Transaction[], ranges: ResolvedComparisonRanges) =>
  buildPeriodComparison(
    computeIncomeExpense(transactions, [], CATEGORIES, ranges.current),
    computeIncomeExpense(transactions, [], CATEGORIES, ranges.previous),
    CATEGORIES
  );

describe('resolveComparisonRanges', () => {
  const march = { from: new Date(2026, 2, 1), to: new Date(2026, 2, 31, 23, 59, 59, 999) };

  it('puts the previous window immediately before the current one, same length', () => {
    const ranges = resolveComparisonRanges(march, 'previous-period');

    expect(ranges).not.toBeNull();
    if (!ranges) return;
    expect(ranges.previous.to.getTime()).toBe(march.from.getTime() - 1);
    expect(ranges.previous.to.getTime() - ranges.previous.from.getTime()).toBe(
      march.to.getTime() - march.from.getTime()
    );
    // The windows never overlap.
    expect(ranges.previous.to.getTime()).toBeLessThan(ranges.current.from.getTime());
  });

  it('shifts both bounds back a calendar year for the year-on-year basis', () => {
    const ranges = resolveComparisonRanges(march, 'same-period-last-year');

    expect(ranges?.previous.from).toEqual(new Date(2025, 2, 1));
    expect(ranges?.previous.to).toEqual(new Date(2025, 2, 31, 23, 59, 59, 999));
  });

  it('runs an open-ended window to the end of today', () => {
    const now = new Date(2026, 2, 15, 9, 30);
    const ranges = resolveComparisonRanges({ from: new Date(2026, 2, 1), to: null }, 'previous-period', now);

    expect(ranges?.current.to).toEqual(new Date(2026, 2, 15, 23, 59, 59, 999));
  });

  it('refuses to compare a window with no start — All time has no "before"', () => {
    expect(resolveComparisonRanges({ from: null, to: null }, 'previous-period')).toBeNull();
    expect(resolveComparisonRanges({ from: null, to: new Date(2026, 2, 31) }, 'same-period-last-year')).toBeNull();
  });

  it('refuses an inverted window', () => {
    expect(
      resolveComparisonRanges({ from: new Date(2026, 2, 31), to: new Date(2026, 2, 1) }, 'previous-period')
    ).toBeNull();
  });
});

describe('buildPeriodComparison', () => {
  const ranges = resolveComparisonRanges(
    { from: new Date(2026, 2, 1), to: new Date(2026, 2, 31, 23, 59, 59, 999) },
    'previous-period'
  );

  it('states each side of both windows with the change between them', () => {
    expect(ranges).not.toBeNull();
    if (!ranges) return;
    const result = compare(
      [
        // Current window (March).
        txn({ id: 'c1', amount: -120, date: new Date(2026, 2, 10) }),
        txn({ id: 'c2', amount: 900, date: new Date(2026, 2, 25), category: 'grp-pay', type: 'income' }),
        // Previous window (February).
        txn({ id: 'p1', amount: -100, date: new Date(2026, 1, 10) }),
        txn({ id: 'p2', amount: 600, date: new Date(2026, 1, 25), category: 'grp-pay', type: 'income' }),
      ],
      ranges
    );

    expect(result.expenses).toEqual({ current: 120, previous: 100, change: 20, changePercent: 20 });
    expect(result.income).toEqual({ current: 900, previous: 600, change: 300, changePercent: 50 });
    expect(result.net).toEqual({ current: 780, previous: 500, change: 280, changePercent: 56 });
  });

  it('reports no percentage — not infinity — when the comparison period holds nothing', () => {
    expect(ranges).not.toBeNull();
    if (!ranges) return;
    const result = compare([txn({ id: 'c1', amount: -50, date: new Date(2026, 2, 10) })], ranges);

    expect(result.expenses.previous).toBe(0);
    expect(result.expenses.change).toBe(50);
    expect(result.expenses.changePercent).toBeNull();
    expect(result.income).toEqual({ current: 0, previous: 0, change: 0, changePercent: null });
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].changePercent).toBeNull();
  });

  it('shows a category that has stopped as a fall to zero', () => {
    expect(ranges).not.toBeNull();
    if (!ranges) return;
    const result = compare([txn({ id: 'p1', amount: -80, date: new Date(2026, 1, 10) })], ranges);

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toMatchObject({
      categoryId: 'cat-power',
      name: 'Home : Power',
      bucket: 'expense',
      current: 0,
      previous: 80,
      change: -80,
      changePercent: -100,
    });
  });

  it('names categories, never ids, and orders by the biggest move', () => {
    expect(ranges).not.toBeNull();
    if (!ranges) return;
    const result = compare(
      [
        txn({ id: 'c1', amount: -10, date: new Date(2026, 2, 5) }),
        txn({ id: 'c2', amount: 1000, date: new Date(2026, 2, 6), category: 'grp-pay', type: 'income' }),
        txn({ id: 'p1', amount: -5, date: new Date(2026, 1, 5) }),
      ],
      ranges
    );

    expect(result.categories.map(c => c.name)).toEqual(['Salary', 'Home : Power']);
    expect(result.categories[0].bucket).toBe('income');
  });

  it('nets a refund down rather than treating it as income', () => {
    expect(ranges).not.toBeNull();
    if (!ranges) return;
    const result = compare(
      [
        txn({ id: 'c1', amount: -100, date: new Date(2026, 2, 10) }),
        txn({ id: 'c2', amount: 25, date: new Date(2026, 2, 12), type: 'income' }),
      ],
      ranges
    );

    expect(result.expenses.current).toBe(75);
    expect(result.income.current).toBe(0);
  });

  it('holds decimals exactly across both windows', () => {
    expect(ranges).not.toBeNull();
    if (!ranges) return;
    const result = compare(
      [
        ...Array.from({ length: 3 }, (_, i) =>
          txn({ id: `c${i}`, amount: -0.1, date: new Date(2026, 2, 3 + i) })
        ),
        txn({ id: 'p1', amount: -0.1, date: new Date(2026, 1, 3) }),
      ],
      ranges
    );

    expect(result.expenses.current).toBe(0.3);
    expect(result.expenses.change).toBe(0.2);
  });
});
