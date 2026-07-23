import type { Category } from '../types';
import type { SplitExpandedTransaction } from './transactionSplits';
import { toDecimal } from './decimal';
import { normalizePayee, FALLBACK_BANK_DESCRIPTION } from './payeeAutoCategorize';
import { buildCategoryNameLookup } from './categoryNames';

/**
 * "Spending by payee" — the Microsoft Money report: who the money actually
 * went to, ranked, with the categories each payee is filed under.
 *
 * Classification is NOT re-implemented here. The caller passes the income or
 * expense rows produced by `computeIncomeExpense`, so transfers and
 * uncategorised rows are already excluded and the report's total agrees with
 * every other surface by construction.
 *
 * Payee identity is the same normalisation the app's payee memory and the SQL
 * import prefill use (`normalizePayee`), so "the same payee" means the same
 * thing in a report as it does when a bulk categorisation is remembered.
 *
 * Sign convention (matching the summary cards): values are POSITIVE
 * magnitudes on both sides, and a credit filed against the same payee (a
 * refund) nets that payee's figure DOWN — it can legitimately reach zero or
 * turn negative.
 */

/**
 * Grouping key for rows with no usable payee: an empty description, or the
 * bank-sync sentinel that stands in for one. Lower case, so it can never
 * collide with a real key (`normalizePayee` upper-cases).
 */
export const NO_PAYEE_KEY = '(no payee)';

/** The payee identity a transaction groups under. */
export function payeeKeyOf(description: string): string {
  const key = normalizePayee(description);
  return key === '' || key === FALLBACK_BANK_DESCRIPTION ? NO_PAYEE_KEY : key;
}

export interface PayeeTotalRow {
  /** Normalised payee — the grouping key, and the drill-in filter. */
  payee: string;
  /** How the payee reads in the register (first occurrence, original case). */
  displayName: string;
  /** Net magnitude across the period (refunds subtract). */
  total: number;
  count: number;
  /** Share of the side's total, 0–100. Zero when the side nets to nothing. */
  share: number;
  /** The category this payee is filed under most often — a name, never an id. */
  topCategoryName: string;
  /** How many of the payee's rows carry that category. */
  topCategoryCount: number;
  earliest: Date;
  latest: Date;
}

export interface PayeeTotals {
  rows: PayeeTotalRow[];
  /** The side's total — the sum the rows' shares are taken of. */
  total: number;
}

interface PayeeAccumulator {
  payee: string;
  displayName: string;
  total: ReturnType<typeof toDecimal>;
  count: number;
  categoryCounts: Map<string, { count: number; latest: number }>;
  earliest: Date;
  latest: Date;
}

/**
 * Rank payees by value for one side of the report.
 *
 * @param rows   Already-classified rows (`flows.expenseRows` / `flows.incomeRows`).
 * @param bucket Which side those rows are — decides the sign of the magnitude.
 */
export function buildPayeeTotals(
  rows: SplitExpandedTransaction[],
  bucket: 'income' | 'expense',
  categories: Category[]
): PayeeTotals {
  const categoryName = buildCategoryNameLookup(categories);
  const groups = new Map<string, PayeeAccumulator>();
  let total = toDecimal(0);

  for (const row of rows) {
    const payee = payeeKeyOf(row.description);
    // Spending is stored negative, so negate to read as a positive magnitude
    // and let a refund credit subtract.
    const value = bucket === 'income' ? toDecimal(row.amount) : toDecimal(row.amount).negated();
    const date = new Date(row.date);
    total = total.plus(value);

    const existing = groups.get(payee);
    const group: PayeeAccumulator = existing ?? {
      payee,
      displayName: payee === NO_PAYEE_KEY ? 'No payee recorded' : row.description.trim(),
      total: toDecimal(0),
      count: 0,
      categoryCounts: new Map(),
      earliest: date,
      latest: date,
    };
    group.total = group.total.plus(value);
    group.count += 1;
    if (date < group.earliest) group.earliest = date;
    if (date > group.latest) group.latest = date;
    if (row.category) {
      const entry = group.categoryCounts.get(row.category) ?? { count: 0, latest: 0 };
      entry.count += 1;
      entry.latest = Math.max(entry.latest, date.getTime());
      group.categoryCounts.set(row.category, entry);
    }
    if (!existing) groups.set(payee, group);
  }

  const sideTotal = total.toNumber();

  const out: PayeeTotalRow[] = [...groups.values()].map(group => {
    // Most-used category wins, ties broken by the most recent — the same rule
    // the bulk-categorise suggestions follow, so the report and the tool agree
    // about "how this payee is usually filed".
    const ranked = [...group.categoryCounts.entries()].sort(
      (a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest
    );
    const value = group.total.toNumber();
    return {
      payee: group.payee,
      displayName: group.displayName === '' ? 'No payee recorded' : group.displayName,
      total: value,
      count: group.count,
      share: total.isZero() ? 0 : group.total.dividedBy(total).times(100).toNumber(),
      topCategoryName: ranked.length > 0 ? categoryName(ranked[0][0]) : 'Uncategorised',
      topCategoryCount: ranked.length > 0 ? ranked[0][1].count : 0,
      earliest: group.earliest,
      latest: group.latest,
    };
  });

  // Biggest first; ties broken by row count then name so the order is stable
  // between renders and between sessions.
  out.sort(
    (a, b) =>
      b.total - a.total ||
      b.count - a.count ||
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  );

  return { rows: out, total: sideTotal };
}
