import { toDecimal } from './decimal';
import type { Transaction } from '../types';

/**
 * ─ THE RULE, WRITTEN DOWN ONCE ─────────────────────────────────────────────
 *
 * WHEN ONE LEG OF A LINKED TRANSFER IS DELETED, THE SURVIVOR IS RELEASED.
 *
 * A transfer must have another side or it is not a transfer
 * (utils/transferCoherence.ts is where that law is stated, and the Data Health
 * panel counts the rows already breaking it). Deleting one leg is the last path
 * that could leave a row on the wrong side of it, because the delete itself
 * takes only the LINK off the survivor:
 *
 *   cloud    `transactions_linked_transfer_id_fkey` is ON DELETE SET NULL, so
 *            Postgres nulls `linked_transfer_id` and touches nothing else;
 *   browser  DataService.deleteTransaction does the same by hand;
 *   local    crates/wealth-core `delete_transaction` states it explicitly —
 *            "it does not unlink the other half of a transfer. It does not have
 *            to" — and holds the split-leg guard so SQLite agrees.
 *
 * MEASURED, all three engines: what is left is a row still typed `transfer`,
 * still filed under "To/From <the account whose row has just been deleted>",
 * still carrying `transferAccountId`, and with nothing on the other side. That
 * row moves its account's balance, counts as NEITHER income NOR spending in any
 * report (every report classifies by category, and the category says transfer),
 * and never reaches the uncategorised review band either, because it holds a
 * real category id. The balance moved and no report heard.
 *
 * ─ WHAT RELEASE IS ─────────────────────────────────────────────────────────
 * Exactly the disposition the re-pointing dialog already offers under "Leave it
 * where it is" — `repoint_transfer(… 'release')` in SQL (20260810140000:304-321)
 * and its browser mirror in DataService.repointTransfer. Same semantic, same
 * five fields, and deliberately the same words, because a user who has met one
 * of them has met both:
 *
 *   type                → the money's own direction: out is an expense, in is
 *                         income. The row still happened; only the claim that
 *                         it was half of a movement between two accounts goes.
 *   category            → cleared. The app does not know what this payment was,
 *                         only that it was not this transfer. A guess here
 *                         would be worse than a blank: a blank lands the row in
 *                         the review band, where filing it is one click.
 *   categoryConfirmed   → true. The blank is a decision, not the app's guess,
 *                         so no "suggested" badge is shown against it.
 *   needsReview         → true. The register's own way of saying "there is work
 *                         here", set because the work is in an account the user
 *                         is not looking at.
 *   transferAccountId   → cleared. Left behind, it points at the account of a
 *                         row that no longer exists, and the editor still shows
 *                         the row as a transfer with "no other side recorded".
 *
 * Nothing else is touched: same account, same amount, same date, same
 * description, same cleared/reconciled marks. A release is a change of KIND,
 * never of fact, and no money moves — which is why there is no Decimal
 * arithmetic here, only a sign test.
 *
 * ─ WHERE IT IS APPLIED ─────────────────────────────────────────────────────
 * In AppContextSupabase.deleteTransaction, the one function every delete in the
 * app goes through (the register's single and bulk deletes, the phone's swipe,
 * the global list, the editor, the duplicate sweep). It is applied ABOVE the
 * seam on purpose: this is a rule about what the app's data must mean, not
 * about how one engine stores it, so putting it here makes it impossible for
 * the cloud, browser-storage and local editions to answer it differently.
 */

/**
 * The five fields that stop a row being half of a transfer.
 *
 * Empty strings rather than `undefined` for the two cleared columns: the update
 * RPC clears a column when the key is present and empty, and IGNORES keys that
 * are absent (`CASE WHEN p ? 'category' …`, `NULLIF(p->>'transfer_account_id',
 * '')`). Sending `undefined` would serialise the key away and leave both
 * columns exactly as they were.
 */
export interface TransferReleaseUpdates {
  type: 'income' | 'expense';
  category: '';
  categoryConfirmed: true;
  needsReview: true;
  transferAccountId: '';
}

/**
 * Income or expense, by the money's own direction.
 *
 * Zero counts as income, matching `repoint_transfer`'s `CASE WHEN amount < 0
 * THEN 'expense' ELSE 'income' END` and the local mirror's `isNegative()`. A
 * zero-amount transfer is refused everywhere it could be created, so the tie is
 * only ever reached by data that arrived from somewhere else.
 */
export function releaseTypeFor(amount: number): 'income' | 'expense' {
  return toDecimal(amount).isNegative() ? 'expense' : 'income';
}

/** The release, as a partial update the port will honour verbatim. */
export function releaseUpdatesFor(survivor: Pick<Transaction, 'amount'>): TransferReleaseUpdates {
  return {
    type: releaseTypeFor(survivor.amount),
    category: '',
    categoryConfirmed: true,
    needsReview: true,
    transferAccountId: '',
  };
}

/**
 * The rows that would be left holding half a transfer if `deletedId` went, and
 * that the release therefore applies to.
 *
 * Normally exactly one. Written as a list because `linked_transfer_id` is not
 * unique in the schema — imported history has produced two rows pointing at the
 * same leg, and a release that fixed one of them and silently ignored the other
 * would be a rule with a hole in it.
 *
 * ─ THE ONE EXCLUSION, AND WHY ──────────────────────────────────────────────
 * A SPLIT PARENT is left alone. A split's filing lives in its LINES, not in the
 * parent's category field, so "clear the category and re-type by direction"
 * describes nothing that exists: the parent's type is a summary of its lines
 * and its category is unread. This is the same exclusion
 * `findMismatchedTransferFilings` makes, for the same reason, so the measure and
 * the cure cannot disagree about which rows the law is even about.
 *
 * Note what is NOT excluded: a survivor whose own other half was one LINE of the
 * split being deleted. That row is an ordinary transaction that has just lost
 * its counterpart, and it needs releasing exactly like any other.
 */
export function survivorsOfDeletedLeg(
  deletedId: string,
  transactions: readonly Transaction[]
): Transaction[] {
  return transactions.filter(t => t.linkedTransferId === deletedId && t.isSplit !== true);
}

/** What became of one survivor — the truth a caller has to report from. */
export interface TransferSurvivorOutcome {
  transactionId: string;
  /** Where it stayed. Named so a caller can say which register to go and look in. */
  accountId: string;
  /**
   * True when the release was WRITTEN. False when the delete succeeded but the
   * release did not: the link is off (the store does that itself) and nothing
   * else is, so the row is still typed as a transfer with no other side. A
   * caller reporting a failure must read this rather than assume.
   */
  released: boolean;
}

/** What one delete did, beyond removing its own row. */
export interface DeleteTransactionOutcome {
  /** Empty for an ordinary row; one entry for a linked leg. */
  survivors: readonly TransferSurvivorOutcome[];
}

/** A delete that had no other side to answer for. */
export const NO_SURVIVORS: DeleteTransactionOutcome = { survivors: [] };

// ─────────────────────────────────────────────────────────────────────────────
// Deleting BOTH sides
// ─────────────────────────────────────────────────────────────────────────────

/** The one operation the pair delete needs, injected so it is testable as it runs. */
export interface TransferPairDeleteOps {
  deleteTransaction: (id: string) => Promise<DeleteTransactionOutcome>;
}

export type TransferPairDeleteResult =
  /** Both rows gone. The movement is undone. */
  | { kind: 'both-deleted' }
  /** The first delete failed, so NOTHING was deleted and the pair is intact. */
  | { kind: 'nothing-deleted'; error: unknown }
  /**
   * One row went and the other did not. `message` says which side survived and
   * what state it is in, in the user's terms — it is the whole reason this
   * function exists rather than two calls at the call site.
   */
  | { kind: 'one-deleted'; error: unknown; message: string };

/**
 * Delete both halves of a linked transfer.
 *
 * ─ WHY TWO SEQUENTIAL DELETES ARE ENOUGH ───────────────────────────────────
 * There is no delete-both RPC and this stream does not write one: a migration
 * for an operation whose only failure mode is recoverable and reportable would
 * be out of proportion. What atomicity buys is that nothing is left half-done;
 * what this buys instead is that a half-done delete leaves a COHERENT row and
 * says so. The first delete releases the survivor (see the rule at the top of
 * this file), so even the failure path ends with a row the app has a name for
 * and the review band shows — never a transfer with nothing on the other side.
 *
 * ─ WHY THE LEG THE USER WAS LOOKING AT GOES FIRST ──────────────────────────
 * It is the row they pointed at. If only one delete can happen, the one that
 * happens should be the one they asked for; and the survivor is then in another
 * account, where the register they are looking at will not silently show a row
 * they asked to delete quietly change shape instead.
 */
export async function deleteTransferPair(
  leg: Pick<Transaction, 'id' | 'description'>,
  otherSide: Pick<Transaction, 'id' | 'amount'>,
  otherSideAccountName: string | undefined,
  ops: TransferPairDeleteOps
): Promise<TransferPairDeleteResult> {
  let outcome: DeleteTransactionOutcome;
  try {
    outcome = await ops.deleteTransaction(leg.id);
  } catch (error) {
    return { kind: 'nothing-deleted', error };
  }

  try {
    await ops.deleteTransaction(otherSide.id);
    return { kind: 'both-deleted' };
  } catch (error) {
    const released = outcome.survivors.find(s => s.transactionId === otherSide.id)?.released === true;
    return {
      kind: 'one-deleted',
      error,
      message: describeSurvivingOtherSide(leg, otherSide, otherSideAccountName, released),
    };
  }
}

/**
 * "This side went, that one did not, and here is what it is now."
 *
 * Two versions because there are two truths, and which one holds depends on
 * whether the release was written. Reporting the wrong one would send the user
 * looking for an uncategorised row that is still filed as a transfer, or the
 * other way about.
 */
function describeSurvivingOtherSide(
  leg: Pick<Transaction, 'description'>,
  otherSide: Pick<Transaction, 'amount'>,
  otherSideAccountName: string | undefined,
  released: boolean
): string {
  const where = otherSideAccountName ? `in ${otherSideAccountName}` : 'in the account it faced';
  const kind = releaseTypeFor(otherSide.amount) === 'expense' ? 'payment' : 'deposit';
  const head = `“${leg.description}” was deleted, but its other half ${where} was not.`;

  return released
    ? `${head} That row is still there, still counted in that account’s balance. It is no longer a transfer — it is now an uncategorised ${kind} waiting to be filed. Delete it there if you meant the whole movement to go.`
    : `${head} That row is still there, still counted in that account’s balance, and still marked as a transfer with nothing on the other side. Open it in that account to delete it or give it a category.`;
}
