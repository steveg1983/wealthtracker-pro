/**
 * Review state — "has anybody looked at this row since it arrived?"
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
 * This is category provenance (src/utils/categoryProvenance.ts) widened from
 * one field to the whole row. Provenance asks "did a human vouch for this
 * CATEGORY?"; review asks "did a human look at this ROW?" — and the two are
 * genuinely different questions, because a row can arrive with a perfectly good
 * category the file itself stated and still be a transaction nobody has laid
 * eyes on.
 *
 * ── THE RULE, IN ONE PLACE ──────────────────────────────────────────────────
 * `needsReview === true` means "this arrived from an import and nobody has
 * saved it since". EVERY other value — false, undefined, missing — means
 * reviewed. That asymmetry is deliberate and load-bearing, and it is the mirror
 * image of the one in categoryProvenance:
 *
 *   * The column is `NOT NULL DEFAULT false`, so any writer that has never
 *     heard of review produces a reviewed row. Only the import paths say true.
 *   * `undefined` is what every row carries on a database that has not had the
 *     migration applied yet, and on the local/demo store. Reading that as "new"
 *     would print the owner's entire fifty-one thousand row history in bold on
 *     the day of the deploy.
 *   * The migration leaves existing history at false for the same reason: the
 *     flag starts meaning something from the next import onward, which is where
 *     the problem actually is.
 *
 * Nothing here is money and nothing here is a date, so there is no Decimal and
 * no boundary conversion to get wrong: it is one boolean, read the same way by
 * every surface that asks.
 */

import type { Transaction } from '../types';

/** Enough of a transaction to judge whether it still wants looking at. */
export type ReviewableRow = Pick<Transaction, 'needsReview'>;

/**
 * A row that arrived from an import and has not been saved since.
 *
 * Note the `=== true`: see the asymmetry above. This is the ONE predicate every
 * surface asks — the register's bold, the register's counter, the register's
 * filter and the Accounts list's column — so that four places cannot drift into
 * four slightly different answers to one question.
 */
export function isAwaitingReview(row: ReviewableRow): boolean {
  return row.needsReview === true;
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
