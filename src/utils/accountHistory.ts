import type { Transaction } from '../types';

/**
 * Has an account any recorded money in it at all?
 *
 * Asked before offering an edit that would re-interpret every figure already
 * stored — today that is exactly one edit, the account's CURRENCY, which
 * changes what recorded numbers MEAN rather than what they are.
 *
 * ── WHY TRANSACTIONS ALONE ANSWER IT, SPLITS INCLUDED ───────────────────────
 *
 * A split is not a separate kind of history that could hide from this count:
 * `TransactionSplit.transactionId` names a parent transaction, and that parent
 * sits in an account like any other row — so an account whose only history is a
 * split still has the parent here. The other direction holds too: a split LINE
 * that names a transfer target has a real counterpart TRANSACTION written into
 * that target account (see the `linkedTransferId` note on TransactionSplit and
 * `set_transaction_splits_with_legs`), never a bare line floating in an account
 * with no row. There is no arrangement of splits that puts money in an account
 * without putting a transaction in it, which is why this takes no splits
 * argument rather than taking one and ignoring it.
 *
 * ── ARCHIVED ROWS COUNT ─────────────────────────────────────────────────────
 *
 * Deliberately not filtered. Archiving hides a row from the live register; it
 * does not un-record the money (`setTransactionArchived` flips a flag and is
 * balance-neutral, and `unarchiveAccount` brings them all back). An account
 * whose history has been archived away would otherwise read as empty here and
 * license a re-denomination of the very figures the user still owns — the
 * quietest possible version of the bug this function exists to prevent.
 *
 * Context state carries archived rows exactly like any other, so this is a
 * plain scan with nothing excluded.
 */
export function accountHasHistory(
  transactions: readonly Transaction[],
  accountId: string
): boolean {
  if (!accountId) return false;
  return transactions.some(transaction => transaction.accountId === accountId);
}
