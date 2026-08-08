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
 *
 * A category that carried money BOTH ways gets one row per side, never one
 * blended line — see `accumulate`.
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
  /**
   * What identifies the ROW — the category id is not enough, because a
   * direction-neutral category has one row per side (see `accumulate`). Use
   * this as the React key; use `categoryId` to look the category up.
   */
  rowId: string;
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

type Bucket = 'income' | 'expense';

/** Which row a category's money lands in: one per category PER SIDE. */
interface RowIdentity {
  bucket: Bucket;
  categoryId: string;
}

function rowIdOf(bucket: Bucket, categoryId: string): string {
  return `${bucket}:${categoryId}`;
}

/**
 * Totals a side's rows into one entry per (category, SIDE).
 *
 * Both sides are kept apart deliberately, the same way
 * `buildMonthlyCategoryMatrix` builds its income and expense halves
 * separately. A direction-neutral ('both') category is filed by the money's
 * own direction — the shipped "Account Adjustments" is one — so the SAME
 * category can carry money in and money out. Adding those together would
 * report a figure that is neither: £100 received and £40 spent is not £140 of
 * anything, and the change and percentage columns would compound the error.
 * Two rows, one per side, is what the reader can actually act on.
 *
 * Within a side the netting is unchanged: spending is stored negative, so
 * negating makes both sides positive magnitudes and a refund credit nets its
 * category down (the same convention `categoryNetting` uses for the spending
 * breakdown).
 */
function accumulate(
  rows: SplitExpandedTransaction[],
  bucket: Bucket,
  into: Map<string, ReturnType<typeof toDecimal>>,
  identities: Map<string, RowIdentity>
): void {
  for (const row of rows) {
    if (!row.category) continue;
    const value = bucket === 'income' ? toDecimal(row.amount) : toDecimal(row.amount).negated();
    const rowId = rowIdOf(bucket, row.category);
    identities.set(rowId, { bucket, categoryId: row.category });
    into.set(rowId, (into.get(rowId) ?? toDecimal(0)).plus(value));
  }
}

export function buildPeriodComparison(
  current: IncomeExpenseBreakdown,
  previous: IncomeExpenseBreakdown,
  categories: Category[]
): PeriodComparison {
  const categoryName = buildCategoryNameLookup(categories);
  // Every row either window produced, keyed by side and category — so a row's
  // side is what it IS, never whichever set of rows was counted last.
  const identities = new Map<string, RowIdentity>();

  const currentTotals = new Map<string, ReturnType<typeof toDecimal>>();
  const previousTotals = new Map<string, ReturnType<typeof toDecimal>>();
  for (const [rows, bucket, into] of [
    [current.incomeRows, 'income', currentTotals],
    [current.expenseRows, 'expense', currentTotals],
    [previous.incomeRows, 'income', previousTotals],
    [previous.expenseRows, 'expense', previousTotals],
  ] as const) {
    accumulate(rows, bucket, into, identities);
  }

  const zero = toDecimal(0);
  const categoryRows: ComparisonCategoryRow[] = [...identities]
    .map(([rowId, { bucket, categoryId }]) => ({
      rowId,
      categoryId,
      name: categoryName(categoryId),
      bucket,
      ...figureOf(
        (currentTotals.get(rowId) ?? zero).toNumber(),
        (previousTotals.get(rowId) ?? zero).toNumber()
      ),
    }))
    // Biggest MOVE first — the point of the report is what changed. Ties fall
    // back to the current figure, then the name, then the side (the two halves
    // of one 'both' category can tie on all three), so the order never wobbles.
    .sort(
      (a, b) =>
        Math.abs(b.change) - Math.abs(a.change) ||
        Math.abs(b.current) - Math.abs(a.current) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
        (a.bucket === b.bucket ? 0 : a.bucket === 'income' ? -1 : 1)
    );

  const income = figureOf(current.income.toNumber(), previous.income.toNumber());
  const expenses = figureOf(current.expenses.toNumber(), previous.expenses.toNumber());
  const net = figureOf(
    current.income.minus(current.expenses).toNumber(),
    previous.income.minus(previous.expenses).toNumber()
  );

  return { income, expenses, net, categories: categoryRows };
}
