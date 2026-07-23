import { describe, it, expect } from 'vitest';
import { buildMonthlyCategoryMatrix, monthKeyOf } from './monthlyCategoryMatrix';
import { computeIncomeExpense } from './incomeExpense';
import type { Category, Transaction } from '../types';
import type { PeriodRange } from '../hooks/usePeriod';

/**
 * Synthetic tree only — no real payees, amounts or account names ever appear
 * in this repo's fixtures.
 */
const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },

  // Income group with detail children
  { id: 'grp-invest', name: 'Investment Income', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'cat-dividends', name: 'Dividends', type: 'income', level: 'detail', parentId: 'grp-invest' },
  { id: 'cat-interest', name: 'Interest', type: 'income', level: 'detail', parentId: 'grp-invest' },
  // Income group posted to directly (no children)
  { id: 'grp-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },

  // Expense groups
  { id: 'grp-food', name: 'Food Related Costs', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'cat-diningout', name: 'Dining Out', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'grp-household', name: 'Household', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-repairs', name: 'Repairs', type: 'expense', level: 'detail', parentId: 'grp-household' },

  { id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'detail', parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-2' },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date(2026, 0, 15),
  amount: -10,
  description: 'synthetic row',
  category: '',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

/** Jan–Mar 2026 inclusive. */
const RANGE: PeriodRange = { from: new Date(2026, 0, 1), to: new Date(2026, 2, 31, 23, 59, 59, 999) };

const build = (transactions: Transaction[], range: PeriodRange = RANGE) => {
  const flows = computeIncomeExpense(transactions, [], CATEGORIES, {
    from: range.from ?? undefined,
    to: range.to ?? undefined,
  });
  return buildMonthlyCategoryMatrix(flows.incomeRows, flows.expenseRows, CATEGORIES, range, {
    now: new Date(2026, 2, 20),
  });
};

describe('monthKeyOf', () => {
  it('keys by LOCAL month, matching the period picker windows', () => {
    expect(monthKeyOf(new Date(2026, 6, 1, 0, 30))).toBe('2026-07');
    expect(monthKeyOf(new Date(2026, 11, 31, 23, 30))).toBe('2026-12');
  });
});

describe('buildMonthlyCategoryMatrix', () => {
  it('lays the period out as columns, including months with no activity', () => {
    const matrix = build([
      txn({ id: 'a', date: new Date(2026, 0, 10), amount: -40, category: 'cat-groceries' }),
      txn({ id: 'b', date: new Date(2026, 2, 10), amount: -25, category: 'cat-groceries' }),
    ]);

    expect(matrix.months.map(m => m.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    const food = matrix.expenseGroups.find(g => g.groupId === 'grp-food');
    // February is empty but still a column, and still a zero — never a gap.
    expect(food?.values).toEqual([40, 0, 25]);
    expect(matrix.expenseValues).toEqual([40, 0, 25]);
    expect(matrix.expenseTotal).toBe(65);
  });

  it('groups rows by the user\'s own tree and subtotals each group', () => {
    const matrix = build([
      txn({ id: 'a', date: new Date(2026, 0, 5), amount: -40, category: 'cat-groceries' }),
      txn({ id: 'b', date: new Date(2026, 0, 9), amount: -15, category: 'cat-diningout' }),
      txn({ id: 'c', date: new Date(2026, 1, 3), amount: -200, category: 'cat-repairs' }),
      txn({ id: 'd', date: new Date(2026, 0, 2), amount: 30, type: 'income', category: 'cat-dividends' }),
      txn({ id: 'e', date: new Date(2026, 0, 2), amount: 5, type: 'income', category: 'cat-interest' }),
      // Posted straight onto a group that has no children of its own.
      txn({ id: 'f', date: new Date(2026, 0, 28), amount: 2500, type: 'income', category: 'grp-salary' }),
    ]);

    expect(matrix.expenseGroups.map(g => g.name)).toEqual(['Food Related Costs', 'Household']);
    const food = matrix.expenseGroups[0];
    expect(food.total).toBe(55);
    expect(food.values).toEqual([55, 0, 0]);
    expect(food.rows.map(r => [r.name, r.total])).toEqual([['Dining Out', 15], ['Groceries', 40]]);
    expect(food.categoryIds.sort()).toEqual(['cat-diningout', 'cat-groceries']);

    expect(matrix.incomeGroups.map(g => [g.name, g.total])).toEqual([
      ['Investment Income', 35],
      ['Salary', 2500],
    ]);
    // A group posted to directly still owns exactly one row: itself.
    const salary = matrix.incomeGroups[1];
    expect(salary.rows.map(r => r.categoryId)).toEqual(['grp-salary']);
  });

  it('nets a refund down instead of inflating income, per month', () => {
    const matrix = build([
      txn({ id: 'a', date: new Date(2026, 0, 5), amount: -100, category: 'cat-groceries' }),
      // Money back IN, filed under the expense category: an expense credit.
      txn({ id: 'b', date: new Date(2026, 0, 20), amount: 40, type: 'income', category: 'cat-groceries' }),
    ]);

    expect(matrix.expenseValues).toEqual([60, 0, 0]);
    expect(matrix.incomeTotal).toBe(0);
    expect(matrix.incomeGroups).toEqual([]);
  });

  it('computes Income less Expenses per month and for the period', () => {
    const matrix = build([
      txn({ id: 'a', date: new Date(2026, 0, 1), amount: 2000, type: 'income', category: 'grp-salary' }),
      txn({ id: 'b', date: new Date(2026, 0, 15), amount: -750.55, category: 'cat-repairs' }),
      txn({ id: 'c', date: new Date(2026, 1, 1), amount: 2000, type: 'income', category: 'grp-salary' }),
      txn({ id: 'd', date: new Date(2026, 1, 15), amount: -2400.45, category: 'cat-repairs' }),
    ]);

    expect(matrix.incomeValues).toEqual([2000, 2000, 0]);
    expect(matrix.expenseValues).toEqual([750.55, 2400.45, 0]);
    expect(matrix.netValues).toEqual([1249.45, -400.45, 0]);
    expect(matrix.netTotal).toBe(849);
    expect(matrix.incomeTotal - matrix.expenseTotal).toBeCloseTo(matrix.netTotal, 10);
  });

  it('excludes uncategorised rows and rows with a dangling category id', () => {
    const matrix = build([
      txn({ id: 'a', date: new Date(2026, 0, 5), amount: -40, category: 'cat-groceries' }),
      txn({ id: 'b', date: new Date(2026, 0, 6), amount: -9999, category: '' }),
      txn({ id: 'c', date: new Date(2026, 0, 7), amount: 250000, type: 'income', category: 'deleted-category-id' }),
    ]);

    expect(matrix.expenseTotal).toBe(40);
    expect(matrix.incomeTotal).toBe(0);
    expect(matrix.expenseGroups.flatMap(g => g.categoryIds)).toEqual(['cat-groceries']);
  });

  it('ignores transfers, by type and by transfer category', () => {
    const matrix = build([
      txn({ id: 'a', date: new Date(2026, 0, 5), amount: -40, category: 'cat-groceries' }),
      txn({ id: 'b', date: new Date(2026, 0, 6), amount: -500, type: 'transfer', category: 'tofrom-savings' }),
      // A transfer category filed on an income-direction row is still a transfer.
      txn({ id: 'c', date: new Date(2026, 0, 7), amount: 500, type: 'income', category: 'tofrom-savings' }),
    ]);

    expect(matrix.expenseTotal).toBe(40);
    expect(matrix.incomeTotal).toBe(0);
    expect(matrix.netTotal).toBe(-40);
  });

  it('drops categories with no activity anywhere in the period', () => {
    const matrix = build([
      txn({ id: 'a', date: new Date(2026, 0, 5), amount: -40, category: 'cat-groceries' }),
    ]);

    expect(matrix.expenseGroups).toHaveLength(1);
    expect(matrix.expenseGroups[0].rows.map(r => r.name)).toEqual(['Groceries']);
  });

  it('caps the columns on a very long window and says how many are hidden, with Total still covering the lot', () => {
    const range: PeriodRange = { from: new Date(2024, 0, 1), to: new Date(2026, 2, 31, 23, 59, 59, 999) };
    const flows = computeIncomeExpense(
      [
        txn({ id: 'old', date: new Date(2024, 0, 15), amount: -100, category: 'cat-groceries' }),
        txn({ id: 'new', date: new Date(2026, 2, 15), amount: -25, category: 'cat-groceries' }),
      ],
      [],
      CATEGORIES,
      { from: range.from ?? undefined, to: range.to ?? undefined }
    );
    const matrix = buildMonthlyCategoryMatrix(flows.incomeRows, flows.expenseRows, CATEGORIES, range, {
      now: new Date(2026, 2, 20),
      maxMonths: 6,
    });

    expect(matrix.months).toHaveLength(6);
    expect(matrix.omittedMonths).toBe(21); // Jan 2024 – Mar 2026 is 27 months
    expect(matrix.months[0].key).toBe('2025-10');
    // The hidden January 2024 spend shows in Total but in no visible column.
    expect(matrix.expenseTotal).toBe(125);
    expect(matrix.expenseValues.reduce((a, b) => a + b, 0)).toBe(25);
  });

  it('an open-ended window runs to today, and an empty period still yields columns', () => {
    const matrix = build([], { from: new Date(2026, 0, 1), to: null });

    expect(matrix.months.map(m => m.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(matrix.incomeGroups).toEqual([]);
    expect(matrix.expenseGroups).toEqual([]);
    expect(matrix.netTotal).toBe(0);
  });

  it('labels columns in the UK short form', () => {
    const matrix = build([]);
    expect(matrix.months.map(m => m.label)).toEqual(['Jan 26', 'Feb 26', 'Mar 26']);
  });
});
