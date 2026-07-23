import type { Category, Transaction, TransactionSplit } from '../types';
import { computeIncomeExpense } from './incomeExpense';
import { expandSplitTransactions } from './transactionSplits';

/**
 * Category "data health": the places where a user's category data is weak, so
 * the Categories page can point at them. Weaker data → weaker reports, so every
 * count here is derived from the SAME classifier and the SAME split expansion
 * the reports use — a health panel that disagreed with the report band it links
 * to would be worse than none.
 *
 * All four measures come off ONE expansion of the split parents:
 *  1. uncategorised — what `classifyFlow` calls 'uncategorized' (no category, a
 *     dangling id, or an unassigned-bucket category), taken straight from
 *     `computeIncomeExpense` so it matches the review band transaction-for-
 *     transaction. Money in/out are that breakdown's uncategorised sums;
 *  2. unassigned-bucket rows — the subset of (1) whose category is the MS Money
 *     importer's bucket. Shown on its own line because the user can clear these
 *     knowingly (the filing was the importer's, not theirs);
 *  3. dangling references — the subset of (1) whose category id matches no
 *     category. Same review-band membership, but the CAUSE is a deleted
 *     category, worth naming separately;
 *  4. empty categories — detail-level categories nothing is filed under
 *     (candidates to delete and simplify the list).
 *
 * (2) and (3) are filtered out of (1)'s rows rather than recomputed, so they are
 * exact subsets and can never drift from the classifier.
 */
export interface CategoryHealth {
  /** Rows the classifier returns 'uncategorized' for (all-time). */
  uncategorizedCount: number;
  /** Money into those rows — positive magnitude, for display only. */
  uncategorizedIn: number;
  /** Money out of those rows — positive magnitude, for display only. */
  uncategorizedOut: number;
  /** Uncategorised rows parked in an unassigned bucket (a subset of the above). */
  unassignedBucketCount: number;
  /** Uncategorised rows whose category id no longer exists (a subset too). */
  danglingCount: number;
  /** Detail categories with no transactions and no split lines. */
  emptyCategoryCount: number;
  /** True when at least one measure is non-zero — the panel renders nothing otherwise. */
  hasWarnings: boolean;
}

/**
 * Measure category data health over ALL transactions (no period filter — the
 * data is either clean or it is not, regardless of the window a report shows).
 */
export function computeCategoryHealth(
  transactions: Transaction[],
  transactionSplits: TransactionSplit[],
  categories: Category[]
): CategoryHealth {
  // Expand split parents into per-line rows ONCE, then reuse those rows for
  // every measure — the same view `useReportDataset` builds, so counts here and
  // figures there read the identical rows. Splits are passed empty to
  // computeIncomeExpense because the rows are already expanded (no re-expansion).
  const rows = expandSplitTransactions(transactions, transactionSplits);
  const flows = computeIncomeExpense(rows, [], categories);

  const categoryIds = new Set(categories.map(c => c.id));
  const bucketIds = new Set(
    categories.filter(c => c.isUnassignedBucket === true).map(c => c.id)
  );

  // (2) and (3) are carved out of the SAME uncategorised rows the review band
  // shows, never recounted — a bucket row carries a real (bucket) category id, a
  // dangling row carries one that resolves to nothing, so the two are disjoint
  // and both sit inside the uncategorised total.
  let unassignedBucketCount = 0;
  let danglingCount = 0;
  for (const row of flows.uncategorizedRows) {
    if (!row.category) continue;
    if (bucketIds.has(row.category)) unassignedBucketCount += 1;
    else if (!categoryIds.has(row.category)) danglingCount += 1;
  }

  // A category is "used" if any expanded row (a whole transaction or one split
  // line) is filed under it — the same tally the page shows in parentheses.
  const usedCategoryIds = new Set<string>();
  for (const row of rows) {
    if (row.category) usedCategoryIds.add(row.category);
  }

  // Empty candidates are only DETAIL leaves the user actually filed things
  // under in normal use. Type/sub levels are containers, not filing targets;
  // transfer/revaluation/unassigned-bucket categories are system bookkeeping
  // whose emptiness is not something to "tighten up"; inactive ones are already
  // hidden from the page, so flagging them would point at nothing visible.
  const emptyCategoryCount = categories.filter(c =>
    c.level === 'detail' &&
    c.isActive !== false &&
    c.isTransferCategory !== true &&
    c.isRevaluationCategory !== true &&
    c.isUnassignedBucket !== true &&
    !usedCategoryIds.has(c.id)
  ).length;

  const uncategorizedCount = flows.uncategorizedRows.length;

  return {
    uncategorizedCount,
    uncategorizedIn: flows.uncategorizedIn.toNumber(),
    uncategorizedOut: flows.uncategorizedOut.toNumber(),
    unassignedBucketCount,
    danglingCount,
    emptyCategoryCount,
    hasWarnings:
      uncategorizedCount > 0 ||
      unassignedBucketCount > 0 ||
      danglingCount > 0 ||
      emptyCategoryCount > 0,
  };
}
