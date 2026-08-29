/**
 * Review state — "does this row still want somebody's eyes?"
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Microsoft Money printed a freshly downloaded transaction in bold and kept it
 * bold until you did something about it. That one convention answered the only
 * question worth asking after an import — WHICH OF THESE HAVE I DEALT WITH? —
 * without a wizard, a queue or a second screen: the work was in the register,
 * in the place the row already sat, and it stopped shouting when it was done.
 *
 * The owner asked for exactly that, and for a counter next to the register's
 * View menu that both states the size of the job and filters the list down to
 * it.
 *
 * ── THE RULE, IN ONE PLACE — WIDENED 29 AUGUST 2026 ─────────────────────────
 * A row awaits review when EITHER:
 *
 *   * `needsReview === true` — it arrived from an import and nobody has saved
 *     it since; or
 *   * it is UNFILED — it has no category. The owner's ruling of 29 August:
 *     "whether the info was injected via bank connection or manually, if there
 *     is a transaction without a category it should flag as needing
 *     reviewing." Unfiled money is never done, however it arrived and however
 *     long ago — which also means saving a row WITHOUT filing it keeps it
 *     flagged, deliberately.
 *
 * The unfiled arm has two exclusions, each argued rather than convenient:
 *
 *   * TRANSFERS take no category — moving money between your own accounts is
 *     not spending or earning, and the Money model this register follows never
 *     asked for one. A transfer is filed by being a transfer.
 *   * SPLIT PARENTS file through their lines, and a register row cannot bold
 *     one line of itself. An unfiled split LINE remains the categorise rung's
 *     work — useAttentionLadder subtracts exactly what this predicate counts,
 *     so the two rungs partition the unfiled backlog rather than both claiming
 *     it.
 *
 * A DANGLING category id (the category was since deleted) is NOT review work
 * either: this predicate is deliberately row-local and cheap — it is asked per
 * row in render paths — and "your filing broke" is a data-health finding
 * (categoryHealth), not a row nobody has looked at.
 *
 * The flag's asymmetry is unchanged and still load-bearing: `needsReview ===
 * true` means new, and EVERY other value — false, undefined, missing — means
 * reviewed, because the column is `NOT NULL DEFAULT false` and a database
 * without the migration returns no key at all. The unfiled arm does not
 * disturb that guarantee in practice: it was measured against the owner's real
 * ledger before shipping, and of fifty-one thousand rows exactly ten were
 * unfiled — every one already flagged by the feed. The day-one bold flood this
 * file has always guarded against does not occur, because a ledger kept the
 * Money way is a ledger that is already filed.
 *
 * Nothing here is money and nothing here is a date, so there is no Decimal and
 * no boundary conversion to get wrong: two booleans and a string emptiness
 * check, read the same way by every surface that asks.
 */

import type { Transaction } from '../types';

/** Enough of a transaction to judge whether it still wants looking at. */
export type ReviewableRow = Pick<
  Transaction,
  'needsReview' | 'category' | 'type' | 'isSplit'
>;

/**
 * The unfiled arm alone: no category, on a row that takes one.
 *
 * Exported for useAttentionLadder, which must subtract THIS EXACT population
 * from the categorise rung — a predicate restated there would drift into
 * double-counting or a gap the day one copy changed.
 */
export function isUnfiled(row: ReviewableRow): boolean {
  if (row.type === 'transfer') return false;
  if (row.isSplit === true) return false;
  return !row.category || row.category.trim() === '';
}

/**
 * A row that still wants somebody's eyes: arrived and never saved, or saved
 * but never filed.
 *
 * This is the ONE predicate every surface asks — the register's bold, the
 * register's counter, the register's filter, the Accounts list's column and
 * the attention ladder's review rung — so that five places cannot drift into
 * five slightly different answers to one question.
 */
export function isAwaitingReview(row: ReviewableRow): boolean {
  return row.needsReview === true || isUnfiled(row);
}

/** How many of these rows are still waiting. */
export function countAwaitingReview(rows: readonly ReviewableRow[]): number {
  let count = 0;
  for (const row of rows) {
    if (isAwaitingReview(row)) count += 1;
  }
  return count;
}

/**
 * Unreviewed rows per account, in one pass.
 *
 * The same mechanism the Unreconciled column already uses (see
 * useReconciliation): build the lookup once from the transaction list, then
 * answer per account in constant time. The alternative — filtering the whole
 * list inside each account's card — is quadratic in the number of accounts, and
 * this list is rendered against a fifty-thousand row ledger.
 *
 * Accounts with nothing waiting are ABSENT rather than present with a zero, so
 * the caller decides how to render "none" (the Accounts column shows a quiet 0
 * beside its neighbours; the register's counter shows nothing at all).
 */
export function countAwaitingReviewByAccount(
  rows: readonly (ReviewableRow & Pick<Transaction, 'accountId'>)[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!isAwaitingReview(row)) continue;
    counts.set(row.accountId, (counts.get(row.accountId) ?? 0) + 1);
  }
  return counts;
}
