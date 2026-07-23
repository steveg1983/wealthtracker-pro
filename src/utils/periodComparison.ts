import type { Category } from '../types';
import type { PeriodRange } from '../hooks/usePeriod';
import type { IncomeExpenseBreakdown } from './incomeExpense';
import type { SplitExpandedTransaction } from './transactionSplits';
import { toDecimal } from './decimal';
import { buildCategoryNameLookup } from './categoryNames';

/**
 * "This period vs …" — the Microsoft Money comparison report.
 *
 * Two windows of EQUAL length are compared: the selected period against
 * either the period immediately before it, or the same dates a year earlier.
 * Nothing here classifies transactions: the caller hands over two
 * `computeIncomeExpense` breakdowns, so transfers and uncategorised rows are
 * already excluded and the current-period figures agree with every other
 * report by construction.
 *
 * Percentages are deliberately NULL rather than infinite when the comparison
 * window holds nothing for that line — "up 100%" from zero is a lie, and the
 * UI says "new" instead.
 */

export type ComparisonBasis = 'previous-period' | 'same-period-last-year';

export const COMPARISON_BASIS_LABELS: Record<ComparisonBasis, string> = {
  'previous-period': 'Previous period',
  'same-period-last-year': 'Same period last year',
};

export interface ResolvedComparisonRanges {
  current: { from: Date; to: Date };
  previous: { from: Date; to: Date };
}

/**
 * Concrete bounds for both windows, or null when the selected period cannot
 * be compared (an open-started window — All time — has no "before").
 */
export function resolveComparisonRanges(
  range: PeriodRange,
  basis: ComparisonBasis,
  now: Date = new Date()
): ResolvedComparisonRanges | null {
  if (!range.from) return null;
  const from = new Date(range.from);
  // An open-ended window runs to the end of today.
  const to = range.to ? new Date(range.to) : endOfDay(now);
  if (to <= from) return null;

  if (basis === 'same-period-last-year') {
    const previousFrom = new Date(from);
    previousFrom.setFullYear(previousFrom.getFullYear() - 1);
    const previousTo = new Date(to);
    previousTo.setFullYear(previousTo.getFullYear() - 1);
    return { current: { from, to }, previous: { from: previousFrom, to: previousTo } };
  }

  // Equal-length window ending the millisecond before the current one starts.
  const durationMs = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - durationMs);
  return { current: { from, to }, previous: { from: previousFrom, to: previousTo } };
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export interface ComparisonFigure {
  current: number;
  previous: number;
  /** current − previous. Positive means MORE this period, on either side. */
  change: number;
  /** Change as a percentage of the previous figure; null when it was zero. */
  changePercent: number | null;
}

export interface ComparisonCategoryRow extends ComparisonFigure {
  categoryId: string;
  /** "Parent : Child" — a category id must never reach the screen. */
  name: string;
  bucket: 'income' | 'expense';
}

export interface PeriodComparison {
  income: ComparisonFigure;
  expenses: ComparisonFigure;
  /** Income less expenses in each window. */
  net: ComparisonFigure;
  /** Every category that carried value in either window, biggest move first. */
  categories: ComparisonCategoryRow[];
}

function figureOf(current: number, previous: number): ComparisonFigure {
  const currentDecimal = toDecimal(current);
  const previousDecimal = toDecimal(previous);
  const change = currentDecimal.minus(previousDecimal);
  return {
    current: currentDecimal.toNumber(),
    previous: previousDecimal.toNumber(),
    change: change.toNumber(),
    changePercent: previousDecimal.isZero()
      ? null
      : change.dividedBy(previousDecimal.abs()).times(100).toNumber(),
  };
}

function accumulate(
  rows: SplitExpandedTransaction[],
  bucket: 'income' | 'expense',
  into: Map<string, ReturnType<typeof toDecimal>>
): void {
  for (const row of rows) {
    if (!row.category) continue;
    // Spending is stored negative — negate so both sides read as positive
    // magnitudes and a refund credit nets its category down.
    const value = bucket === 'income' ? toDecimal(row.amount) : toDecimal(row.amount).negated();
    into.set(row.category, (into.get(row.category) ?? toDecimal(0)).plus(value));
  }
}

export function buildPeriodComparison(
  current: IncomeExpenseBreakdown,
  previous: IncomeExpenseBreakdown,
  categories: Category[]
): PeriodComparison {
  const categoryName = buildCategoryNameLookup(categories);
  const bucketOf = new Map<string, 'income' | 'expense'>();

  const currentTotals = new Map<string, ReturnType<typeof toDecimal>>();
  const previousTotals = new Map<string, ReturnType<typeof toDecimal>>();
  for (const [rows, bucket, into] of [
    [current.incomeRows, 'income', currentTotals],
    [current.expenseRows, 'expense', currentTotals],
    [previous.incomeRows, 'income', previousTotals],
    [previous.expenseRows, 'expense', previousTotals],
  ] as const) {
    accumulate(rows, bucket, into);
    for (const row of rows) {
      if (row.category) bucketOf.set(row.category, bucket);
    }
  }

  const zero = toDecimal(0);
  const categoryRows: ComparisonCategoryRow[] = [...new Set([...currentTotals.keys(), ...previousTotals.keys()])]
    .map(categoryId => ({
      categoryId,
      name: categoryName(categoryId),
      bucket: bucketOf.get(categoryId) ?? 'expense',
      ...figureOf(
        (currentTotals.get(categoryId) ?? zero).toNumber(),
        (previousTotals.get(categoryId) ?? zero).toNumber()
      ),
    }))
    // Biggest MOVE first — the point of the report is what changed. Ties fall
    // back to the current figure, then the name, so the order never wobbles.
    .sort(
      (a, b) =>
        Math.abs(b.change) - Math.abs(a.change) ||
        Math.abs(b.current) - Math.abs(a.current) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

  const income = figureOf(current.income.toNumber(), previous.income.toNumber());
  const expenses = figureOf(current.expenses.toNumber(), previous.expenses.toNumber());
  const net = figureOf(
    current.income.minus(current.expenses).toNumber(),
    previous.income.minus(previous.expenses).toNumber()
  );

  return { income, expenses, net, categories: categoryRows };
}
