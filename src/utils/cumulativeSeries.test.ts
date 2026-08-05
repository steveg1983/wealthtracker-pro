import { describe, it, expect } from 'vitest';
import { runningTotals, toCumulativeMatrix, toCumulativeTrend } from './cumulativeSeries';
import { buildMonthlyCategoryMatrix } from './monthlyCategoryMatrix';
import { buildMonthlyTrend } from './monthlyTrend';
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
  { id: 'grp-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'grp-food', name: 'Food Related Costs', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'cat-diningout', name: 'Dining Out', type: 'expense', level: 'detail', parentId: 'grp-food' },
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

const TRANSACTIONS: Transaction[] = [
  txn({ id: 'i1', date: new Date(2026, 0, 28), amount: 2000, type: 'income', category: 'grp-salary' }),
  txn({ id: 'i2', date: new Date(2026, 1, 28), amount: 2000, type: 'income', category: 'grp-salary' }),
  txn({ id: 'i3', date: new Date(2026, 2, 28), amount: 2000, type: 'income', category: 'grp-salary' }),
  txn({ id: 'e1', date: new Date(2026, 0, 5), amount: -40.25, category: 'cat-groceries' }),
  txn({ id: 'e2', date: new Date(2026, 1, 5), amount: -60.5, category: 'cat-groceries' }),
  txn({ id: 'e3', date: new Date(2026, 2, 5), amount: -10.25, category: 'cat-diningout' }),
];

const flowsOf = (transactions: Transaction[], range: PeriodRange = RANGE) =>
  computeIncomeExpense(transactions, [], CATEGORIES, {
    from: range.from ?? undefined,
    to: range.to ?? undefined,
  });

const matrixOf = (transactions: Transaction[], range: PeriodRange = RANGE, maxMonths?: number) => {
  const flows = flowsOf(transactions, range);
  return buildMonthlyCategoryMatrix(flows.incomeRows, flows.expenseRows, CATEGORIES, range, {
    now: new Date(2026, 2, 20),
    ...(maxMonths === undefined ? {} : { maxMonths }),
  });
};

describe('runningTotals', () => {
  it('adds each period to everything before it', () => {
    expect(runningTotals([10, 20, 30])).toEqual([10, 30, 60]);
  });

  it('starts at zero and survives an empty or single-entry series', () => {
    expect(runningTotals([])).toEqual([]);
    expect(runningTotals([42])).toEqual([42]);
  });

  it('lets a negative period pull the running total back down', () => {
    // A refunded month nets the running total down rather than resetting it.
    expect(runningTotals([100, -30, 5])).toEqual([100, 70, 75]);
  });

  it('accumulates in Decimal — a long series never drifts', () => {
    // Raw float addition gives 0.30000000000000004 by the second entry and
    // compounds from there; these are people's figures.
    expect(runningTotals([0.1, 0.2, 0.3])).toEqual([0.1, 0.3, 0.6]);
    expect(runningTotals(Array.from({ length: 12 }, () => 0.1))[11]).toBe(1.2);
    expect(runningTotals([1234.56, 7890.12, 0.33])).toEqual([1234.56, 9124.68, 9125.01]);
  });
});

describe('toCumulativeMatrix', () => {
  it('turns every category row, subtotal and footer row into a running total', () => {
    const cumulative = toCumulativeMatrix(matrixOf(TRANSACTIONS));

    expect(cumulative.incomeValues).toEqual([2000, 4000, 6000]);
    expect(cumulative.expenseValues).toEqual([40.25, 100.75, 111]);
    expect(cumulative.netValues).toEqual([1959.75, 3899.25, 5889]);

    const food = cumulative.expenseGroups.find(group => group.groupId === 'grp-food');
    expect(food?.values).toEqual([40.25, 100.75, 111]);
    expect(food?.rows.map(row => [row.name, row.values])).toEqual([
      ['Dining Out', [0, 0, 10.25]],
      ['Groceries', [40.25, 100.75, 100.75]],
    ]);
  });

  it('leaves whole-period totals, columns and identities alone', () => {
    const monthly = matrixOf(TRANSACTIONS);
    const cumulative = toCumulativeMatrix(monthly);

    expect(cumulative.months).toEqual(monthly.months);
    expect(cumulative.incomeTotal).toBe(monthly.incomeTotal);
    expect(cumulative.expenseTotal).toBe(monthly.expenseTotal);
    expect(cumulative.netTotal).toBe(monthly.netTotal);
    expect(cumulative.omittedMonths).toBe(monthly.omittedMonths);
    expect(cumulative.expenseGroups.map(group => group.categoryIds))
      .toEqual(monthly.expenseGroups.map(group => group.categoryIds));
    // Non-destructive: the monthly matrix behind it is untouched.
    expect(monthly.expenseValues).toEqual([40.25, 60.5, 10.25]);
  });

  it('the last column equals the period total when no month is hidden', () => {
    const cumulative = toCumulativeMatrix(matrixOf(TRANSACTIONS));

    expect(cumulative.omittedMonths).toBe(0);
    expect(cumulative.expenseValues[cumulative.expenseValues.length - 1]).toBe(cumulative.expenseTotal);
    expect(cumulative.incomeValues[cumulative.incomeValues.length - 1]).toBe(cumulative.incomeTotal);
  });

  it('on a capped window the running total starts at the first column shown, not the period start', () => {
    const range: PeriodRange = { from: new Date(2025, 10, 1), to: new Date(2026, 2, 31, 23, 59, 59, 999) };
    const cumulative = toCumulativeMatrix(
      matrixOf(
        [...TRANSACTIONS, txn({ id: 'old', date: new Date(2025, 10, 3), amount: -500, category: 'cat-groceries' })],
        range,
        3
      )
    );

    expect(cumulative.omittedMonths).toBe(2);
    expect(cumulative.months.map(month => month.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    // The hidden November spend is in the Total but in no column, so the last
    // cumulative column is deliberately short of it — the UI says so.
    expect(cumulative.expenseValues).toEqual([40.25, 100.75, 111]);
    expect(cumulative.expenseTotal).toBe(611);
  });

  it('handles a period with no activity at all', () => {
    const cumulative = toCumulativeMatrix(matrixOf([]));

    expect(cumulative.incomeGroups).toEqual([]);
    expect(cumulative.expenseGroups).toEqual([]);
    expect(cumulative.netValues).toEqual([0, 0, 0]);
  });
});

describe('toCumulativeTrend', () => {
  it('accumulates both series and keeps every month label', () => {
    const trend = buildMonthlyTrend(TRANSACTIONS, CATEGORIES);
    const cumulative = toCumulativeTrend(trend);

    expect(cumulative.map(point => point.monthKey)).toEqual(trend.map(point => point.monthKey));
    expect(cumulative.map(point => point.month)).toEqual(trend.map(point => point.month));
    expect(cumulative.map(point => point.income)).toEqual([2000, 4000, 6000]);
    expect(cumulative.map(point => point.expenses)).toEqual([40.25, 100.75, 111]);
  });

  it('leaves the month-by-month series it was built from untouched', () => {
    const trend = buildMonthlyTrend(TRANSACTIONS, CATEGORIES);
    toCumulativeTrend(trend);

    expect(trend.map(point => point.expenses)).toEqual([40.25, 60.5, 10.25]);
  });

  it('survives an empty series', () => {
    expect(toCumulativeTrend([])).toEqual([]);
  });
});
