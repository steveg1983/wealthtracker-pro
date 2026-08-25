import type { Category, Transaction, TransactionSplit } from '../types';
import { computeIncomeExpense, type FlowFactorResolver } from './incomeExpense';
import { expandSplitTransactions } from './transactionSplits';
import { findMismatchedTransferFilings } from './transferCoherence';

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
 *     (candidates to delete and simplify the list);
 *  5. transfer filings that are not transfers — a row typed income or expense
 *     whose CATEGORY says "To/From <account>", with no other side. See
 *     utils/transferCoherence for why that combination is not a cosmetic
 *     mismatch, and note that this one measure reads the STORED transactions
 *     rather than the expanded rows: a transfer LINE inside a split is a real
 *     Money construct, and the expansion gives every line an income/expense
 *     type from its sign, so measuring it there would report every legitimate
 *     split transfer leg as broken.
 *
 * (2) and (3) are filtered out of (1)'s rows rather than recomputed, so they are
 * exact subsets and can never drift from the classifier.
 *
 * The two MONEY figures convert through the flows seam when the caller hands
 * one over (`opts.convert`), at each row's own date — the same resolver the
 * report dataset uses, so the health line and the report it links to cannot
 * quote the same backlog on two different bases. Without a resolver they stay
 * native and `holdsForeign` is false, which is what the caller's basis line
 * needs in order to say so.
 *
 * Each measure carries whatever its REMEDY needs to act — which bucket, which
 * categories — not just a number. A warning the user cannot act on from where
 * they are reading it is a complaint, and this file's job is to make the fix
 * one click away (see CategoryDataHealthPanel).
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
  /**
   * WHICH bucket holds them, so the warning can open that bucket's rows rather
   * than describe them. Null exactly when `unassignedBucketCount` is 0 — a
   * non-zero count means some bucket holds the rows, so the remedy is never
   * missing from a line that is showing.
   *
   * One importer creates one bucket today (the MS Money "Unassigned" leaf). If
   * a second importer ever adds another, this names the fuller of the two and
   * the rest stay visible in the tree; the COUNT still covers all of them,
   * because the sentence is about the data, not about the link.
   */
  unassignedBucketCategoryId: string | null;
  /** Uncategorised rows whose category id no longer exists (a subset too). */
  danglingCount: number;
  /** Detail categories with no transactions and no split lines. */
  emptyCategoryCount: number;
  /**
   * WHICH categories those are, so the warning can point the tree at them
   * instead of leaving the user to hunt. Same order as `categories` came in;
   * `emptyCategoryCount` is this list's length, so the number the user reads
   * and the rows that light up can never disagree.
   */
  emptyCategoryIds: string[];
  /**
   * Rows typed income/expense but filed under a transfer category, with no
   * counterpart. See `findMismatchedTransferFilings` for the exact set and why
   * each exclusion is there.
   */
  transferFilingMismatchCount: number;
  /**
   * WHICH rows they are, so the remedy can open exactly those and no others.
   * Same contract as `emptyCategoryIds`: the count is this list's length, so
   * the number the user reads and the list they open can never disagree.
   */
  transferFilingMismatchIds: string[];
  /**
   * True when a conversion factor was actually applied to one of the money
   * figures above — the ≈ gate, passed straight through from the flows seam
   * rather than re-derived, so the mark and the arithmetic share one source.
   *
   * False on a single-currency ledger AND when the caller passed no resolver,
   * which are different situations that call for the same mark: no ≈, because
   * nothing was converted. Which of the two it is, the caller's basis line
   * says — see ReportCurrencyNote.
   */
  holdsForeign: boolean;
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
  categories: Category[],
  opts: { convert?: FlowFactorResolver } = {}
): CategoryHealth {
  // Expand split parents into per-line rows ONCE, then reuse those rows for
  // every measure — the same view `useReportDataset` builds, so counts here and
  // figures there read the identical rows. Splits are passed empty to
  // computeIncomeExpense because the rows are already expanded (no re-expansion).
  const rows = expandSplitTransactions(transactions, transactionSplits);
  const flows = computeIncomeExpense(rows, [], categories, { convert: opts.convert });

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
  const rowsPerBucket = new Map<string, number>();
  for (const row of flows.uncategorizedRows) {
    if (!row.category) continue;
    if (bucketIds.has(row.category)) {
      unassignedBucketCount += 1;
      rowsPerBucket.set(row.category, (rowsPerBucket.get(row.category) ?? 0) + 1);
    } else if (!categoryIds.has(row.category)) danglingCount += 1;
  }

  // The bucket the warning's action opens. Chosen by how many rows it actually
  // holds, so with one bucket (the only case today) it is that bucket, and with
  // two it is the one worth opening first.
  let unassignedBucketCategoryId: string | null = null;
  let fullestBucket = 0;
  for (const [id, count] of rowsPerBucket) {
    if (count > fullestBucket) {
      fullestBucket = count;
      unassignedBucketCategoryId = id;
    }
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
  const emptyCategoryIds = categories
    .filter(c =>
      c.level === 'detail' &&
      c.isActive !== false &&
      c.isTransferCategory !== true &&
      c.isRevaluationCategory !== true &&
      c.isUnassignedBucket !== true &&
      !usedCategoryIds.has(c.id)
    )
    .map(c => c.id);
  const emptyCategoryCount = emptyCategoryIds.length;

  const uncategorizedCount = flows.uncategorizedRows.length;

  // The STORED rows, not `rows` — see the note at the top of this file on why
  // split lines are the wrong unit for this one measure.
  const transferFilingMismatchIds = findMismatchedTransferFilings(transactions, categories)
    .map(t => t.id);

  return {
    uncategorizedCount,
    uncategorizedIn: flows.uncategorizedIn.toNumber(),
    uncategorizedOut: flows.uncategorizedOut.toNumber(),
    unassignedBucketCount,
    unassignedBucketCategoryId,
    danglingCount,
    emptyCategoryCount,
    emptyCategoryIds,
    transferFilingMismatchCount: transferFilingMismatchIds.length,
    transferFilingMismatchIds,
    holdsForeign: flows.holdsForeign,
    hasWarnings:
      uncategorizedCount > 0 ||
      unassignedBucketCount > 0 ||
      danglingCount > 0 ||
      emptyCategoryCount > 0 ||
      transferFilingMismatchIds.length > 0,
  };
}
