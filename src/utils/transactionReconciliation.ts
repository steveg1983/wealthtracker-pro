/**
 * Marks and reconciliation — "is this row committed, or just marked?"
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Microsoft Money kept TWO states against a transaction while you balanced an
 * account, and the difference between them is the whole feature:
 *
 *   C — cleared. A working mark. You tick rows off the statement as you read
 *       it, the marks are kept if you close the window and come back next week,
 *       and nothing about the account has been settled yet.
 *   R — reconciled. The committed state. Only pressing Finish produces it, and
 *       only against a statement's ending balance that you stated up front.
 *
 * This app had ONE flag doing both jobs (`cleared` / `transactions.is_cleared`).
 * So "Mark all cleared" WAS the reconciliation: leave the screen and the
 * account showed nothing left to reconcile, which made Finalize a button that
 * did nothing anybody could see. Marking must be a holding state, and Finalize
 * must be the thing that finishes.
 *
 * ── THE RULE, IN ONE PLACE ──────────────────────────────────────────────────
 * `reconciled` is authoritative when it says anything at all. When it says
 * NOTHING — null, undefined, absent — `cleared` answers, because a store that
 * has never heard of the committed flag is a store from the one-flag world, and
 * in that world a cleared row WAS a reconciled row. Three stores are in that
 * position and all three read correctly through this one predicate:
 *
 *   * a database without migration 20260810200000 (the column is not in the
 *     select list, so every row arrives with `reconciled` undefined);
 *   * a row written before that migration (the column is NULL for exactly those
 *     rows — deliberately nullable, so history needed no rewrite and no
 *     51,000-row audit storm, see the migration's own reasoning);
 *   * the local/demo store, whose rows carry whatever they were last written
 *     with.
 *
 * The asymmetry is the mirror image of transactionReview.ts's, and it is chosen
 * the same way: SILENCE MUST BE SAFE. Reading an unanswered row as "not
 * reconciled" would light up a whole imported history as unreconciled work on
 * the day this shipped.
 *
 * Nothing here is money and nothing here is a date, so there is no Decimal and
 * no boundary conversion to get wrong: it is one flag, read the same way by
 * every surface that asks — the Accounts list's Unreconciled column, the
 * reconciliation account list, the register's totals, and the archive.
 */

import type { Transaction } from '../types';

/** Enough of a transaction to judge its mark state. */
export type MarkableRow = Pick<Transaction, 'cleared' | 'reconciled'>;

/**
 * Committed: this row has been through a finalized reconciliation.
 *
 * The ONE predicate every surface asks. Note it is NOT `reconciled === true`:
 * see the fallback rule above — an unanswered row is judged by `cleared`.
 */
export function isReconciled(row: MarkableRow): boolean {
  return row.reconciled ?? row.cleared === true;
}

/**
 * Marked but not committed — the working set Finalize will convert.
 *
 * This is what a person builds up during a session, and what must survive
 * leaving the screen without being mistaken for reconciled work.
 */
export function isMarkedAwaitingFinalize(row: MarkableRow): boolean {
  return row.cleared === true && !isReconciled(row);
}

/** How many of these rows are not committed yet. */
export function countUnreconciled(rows: readonly MarkableRow[]): number {
  let count = 0;
  for (const row of rows) {
    if (!isReconciled(row)) count += 1;
  }
  return count;
}

/**
 * What a `setTransactionsCleared` write leaves the committed flag saying.
 *
 * Written down here because it is one rule with three implementations
 * (set_transactions_cleared, the browser-storage mirror in DataService, and the
 * context's optimistic update), and a rule kept in only some of them is a rule
 * that drifts:
 *
 *   * marking KEEPS whatever the row already said. Marking a row that is
 *     already committed changes nothing about the commitment.
 *   * UNmarking clears it. `reconciled` implies `cleared` — a row that is not
 *     ticked cannot be a row a statement was balanced against, and allowing
 *     that pair would put the cleared balance and the reconciled set
 *     permanently out of step.
 */
export function reconciledAfterMarking(row: MarkableRow, cleared: boolean): boolean {
  return cleared ? isReconciled(row) : false;
}
