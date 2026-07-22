import type { Category } from '../types';
import type { PeriodRange } from '../hooks/usePeriod';
import type { SplitExpandedTransaction } from './transactionSplits';
import { toDecimal, type DecimalInstance } from './decimal';

/**
 * "Monthly income and expenses" — the Microsoft Money report, as a
 * CATEGORY × MONTH matrix.
 *
 * Rows are grouped by the user's OWN category tree (the topmost non-'type'
 * ancestor of each category is the group, so "Food Related Costs" heads its
 * own detail categories) with a subtotal per group; columns are the months of
 * the selected period plus a whole-period Total; the footer carries Total
 * Income, Total Expenses and Income less Expenses.
 *
 * Classification is NOT re-implemented here: the caller passes the income and
 * expense rows produced by `computeIncomeExpense`, so transfers and
 * uncategorised rows are already excluded and every figure agrees with the
 * page's summary cards by construction.
 *
 * Sign convention (matching the summary cards): income and expense values are
 * both POSITIVE magnitudes; a credit filed against an expense category (a
 * refund) nets its cell down and can legitimately make it negative.
 */

export interface MatrixMonth {
  /** YYYY-MM — drives drill-in filtering. */
  key: string;
  /** Column heading, e.g. "Jul 26". */
  label: string;
}

export interface MatrixRow {
  categoryId: string;
  /** Leaf category name (the group heading carries the parent). */
  name: string;
  /** One value per entry in `months`, same order. */
  values: number[];
  /** Whole-period total — covers months the period holds but does not show. */
  total: number;
}

export interface MatrixGroup {
  groupId: string;
  name: string;
  /** Every category id feeding this group — the drill-in filter. */
  categoryIds: string[];
  rows: MatrixRow[];
  values: number[];
  total: number;
}

export interface MonthlyCategoryMatrix {
  months: MatrixMonth[];
  incomeGroups: MatrixGroup[];
  expenseGroups: MatrixGroup[];
  incomeValues: number[];
  incomeTotal: number;
  expenseValues: number[];
  expenseTotal: number;
  /** Income less expenses, per month and for the period. */
  netValues: number[];
  netTotal: number;
  /**
   * Months inside the selected period that are NOT shown as columns (an
   * all-time window can span decades). Totals still cover them, so the UI
   * must say so rather than let the reader assume the columns add up.
   */
  omittedMonths: number;
}

/** Columns rendered at most; the rest of the period folds into Total. */
export const DEFAULT_MAX_MONTHS = 36;

/** Absolute ceiling on the month walk — a corrupt date can't hang the UI. */
const MONTH_WALK_LIMIT = 1200;

/**
 * A date's YYYY-MM in LOCAL time — the same clock `usePeriod` uses to build
 * its windows, so a transaction can never fall outside the columns of the
 * period that selected it.
 */
export function monthKeyOf(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelOf(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

/** The group a category belongs to: its topmost ancestor below the type node. */
function groupCategoryOf(category: Category, byId: ReadonlyMap<string, Category>): Category {
  let node = category;
  for (let hops = 0; hops < 16; hops++) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (!parent || parent.level === 'type' || parent.id === node.id) break;
    node = parent;
  }
  return node;
}

function zeros(length: number): DecimalInstance[] {
  return Array.from({ length }, () => toDecimal(0));
}

interface Bucket {
  category: Category;
  values: DecimalInstance[];
  total: DecimalInstance;
}

interface GroupBucket extends Bucket {
  rows: Map<string, Bucket>;
}

function isEmptyBucket(bucket: Bucket): boolean {
  return bucket.total.isZero() && bucket.values.every(v => v.isZero());
}

function buildSide(
  rows: SplitExpandedTransaction[],
  byId: ReadonlyMap<string, Category>,
  monthIndex: ReadonlyMap<string, number>,
  monthCount: number,
  bucket: 'income' | 'expense'
): { groups: MatrixGroup[]; values: number[]; total: DecimalInstance } {
  const groups = new Map<string, GroupBucket>();
  const sideValues = zeros(monthCount);
  let sideTotal = toDecimal(0);

  for (const row of rows) {
    // The classifier only emits rows with a resolvable category; a row that
    // somehow lacks one is skipped rather than guessed at.
    const category = row.category ? byId.get(row.category) : undefined;
    if (!category) continue;

    // Spending is stored negative — negate so the expense side reads as a
    // positive magnitude and a refund credit subtracts.
    const value = bucket === 'income' ? toDecimal(row.amount) : toDecimal(row.amount).negated();
    const index = monthIndex.get(monthKeyOf(row.date));

    const groupCategory = groupCategoryOf(category, byId);
    let group = groups.get(groupCategory.id);
    if (!group) {
      group = { category: groupCategory, values: zeros(monthCount), total: toDecimal(0), rows: new Map() };
      groups.set(groupCategory.id, group);
    }
    let leaf = group.rows.get(category.id);
    if (!leaf) {
      leaf = { category, values: zeros(monthCount), total: toDecimal(0) };
      group.rows.set(category.id, leaf);
    }

    group.total = group.total.plus(value);
    leaf.total = leaf.total.plus(value);
    sideTotal = sideTotal.plus(value);
    if (index !== undefined) {
      group.values[index] = group.values[index].plus(value);
      leaf.values[index] = leaf.values[index].plus(value);
      sideValues[index] = sideValues[index].plus(value);
    }
  }

  const byName = (a: { name: string }, b: { name: string }): number =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

  const outGroups: MatrixGroup[] = [...groups.values()]
    .filter(group => !isEmptyBucket(group) || [...group.rows.values()].some(r => !isEmptyBucket(r)))
    .map(group => ({
      groupId: group.category.id,
      name: group.category.name,
      categoryIds: [...group.rows.keys()],
      values: group.values.map(v => v.toNumber()),
      total: group.total.toNumber(),
      rows: [...group.rows.values()]
        .filter(leaf => !isEmptyBucket(leaf))
        .map(leaf => ({
          categoryId: leaf.category.id,
          name: leaf.category.name,
          values: leaf.values.map(v => v.toNumber()),
          total: leaf.total.toNumber(),
        }))
        .sort(byName),
    }))
    .sort(byName);

  return { groups: outGroups, values: sideValues.map(v => v.toNumber()), total: sideTotal };
}

function enumerateMonths(
  range: PeriodRange,
  rowSets: SplitExpandedTransaction[][],
  now: Date,
  maxMonths: number
): { months: MatrixMonth[]; omittedMonths: number } {
  let earliest: number | null = null;
  let latest: number | null = null;
  // Only an OPEN end of the window needs the data scanned for its extent.
  if (!range.from || !range.to) {
    for (const rows of rowSets) {
      for (const row of rows) {
        const time = new Date(row.date).getTime();
        if (Number.isNaN(time)) continue;
        if (earliest === null || time < earliest) earliest = time;
        if (latest === null || time > latest) latest = time;
      }
    }
  }

  const startDate = range.from ?? (earliest !== null ? new Date(earliest) : null);
  if (!startDate) return { months: [], omittedMonths: 0 };
  // An open-ended window runs to today, or to the last transaction if the
  // data runs ahead of it (future-dated rows).
  const endDate = range.to
    ?? (latest !== null && latest > now.getTime() ? new Date(latest) : now);
  if (endDate < startDate) return { months: [], omittedMonths: 0 };

  const keys: string[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= last && keys.length < MONTH_WALK_LIMIT) {
    keys.push(monthKeyOf(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const omittedMonths = Math.max(0, keys.length - maxMonths);
  // Keep the MOST RECENT months when a window is longer than the cap.
  return {
    months: keys.slice(omittedMonths).map(key => ({ key, label: monthLabelOf(key) })),
    omittedMonths,
  };
}

export function buildMonthlyCategoryMatrix(
  incomeRows: SplitExpandedTransaction[],
  expenseRows: SplitExpandedTransaction[],
  categories: Category[],
  range: PeriodRange,
  opts: { now?: Date; maxMonths?: number } = {}
): MonthlyCategoryMatrix {
  const now = opts.now ?? new Date();
  const maxMonths = opts.maxMonths ?? DEFAULT_MAX_MONTHS;
  const byId = new Map(categories.map(c => [c.id, c]));

  const { months, omittedMonths } = enumerateMonths(range, [incomeRows, expenseRows], now, maxMonths);
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  const income = buildSide(incomeRows, byId, monthIndex, months.length, 'income');
  const expense = buildSide(expenseRows, byId, monthIndex, months.length, 'expense');

  const netValues = months.map((_, i) =>
    toDecimal(income.values[i]).minus(toDecimal(expense.values[i])).toNumber()
  );

  return {
    months,
    incomeGroups: income.groups,
    expenseGroups: expense.groups,
    incomeValues: income.values,
    incomeTotal: income.total.toNumber(),
    expenseValues: expense.values,
    expenseTotal: expense.total.toNumber(),
    netValues,
    netTotal: income.total.minus(expense.total).toNumber(),
    omittedMonths,
  };
}
