import type { Account, Transaction } from '../types';

/** Where the opposite leg of a linked transfer lives, and whether it is reachable. */
export interface TransferOtherSide {
  /** The counterpart row — the ?txn deep-link target. */
  transactionId: string;
  /** The account the counterpart sits in — the register to open. */
  accountId: string;
  /** Display name; only known while the account is open. */
  accountName?: string;
  /**
   * False when that account is closed (or otherwise absent from the open
   * list). The jump is still offered — the register meets a closed account
   * with the re-open offer — but its name cannot be printed, and the caller
   * says up front what will happen on arrival.
   */
  isOpen: boolean;
}

/**
 * Resolve the other side of a linked transfer, for both directions.
 *
 * The counterpart's OWN accountId is authoritative and is tried first:
 * transfer_account_id is denormalised, and imported history (MS Money .mny,
 * QIF) routinely carries a link with no denormalised account on one leg.
 * transferAccountId is the fallback for the reverse case — the counterpart
 * row absent from the loaded set (it may sit in a closed account), where the
 * denormalised id is all there is.
 *
 * Returns null when the row is not a linked transfer, or when neither source
 * yields an account: there is then nothing to navigate to.
 *
 * @param openAccounts the app context's account list, which carries only OPEN
 *   accounts — membership is therefore the closed-account test.
 */
export function resolveTransferOtherSide(
  transaction: Transaction | null | undefined,
  transactions: readonly Transaction[],
  openAccounts: readonly Account[]
): TransferOtherSide | null {
  if (!transaction?.linkedTransferId) {
    return null;
  }

  const linkedId = transaction.linkedTransferId;
  const linked = transactions.find(t => t.id === linkedId);
  const accountId = linked?.accountId ?? transaction.transferAccountId;
  if (!accountId || accountId === transaction.accountId) {
    return null;
  }

  const account = openAccounts.find(a => a.id === accountId);
  const isOpen = account !== undefined && account.isActive !== false;

  return {
    transactionId: linkedId,
    accountId,
    ...(isOpen && account ? { accountName: account.name } : {}),
    isOpen,
  };
}

/** What a delete would leave behind in the other account. */
export interface DeleteStranding {
  /** One paragraph, ready to render under "Delete Transaction?". */
  message: string;
  /** Where the survivor sits, so a caller can offer to go and deal with it. */
  accountId: string;
  /** The survivor's id, for the same reason. */
  transactionId: string;
}

/**
 * What deleting this row would do to the OTHER side of its transfer — or null
 * when there is no other side and there is therefore nothing extra to say.
 *
 * WHY the confirmation needs this: `transactions_linked_transfer_id_fkey` is
 * ON DELETE SET NULL, and `delete_transaction_atomic` removes one row and
 * reverses one balance. So deleting one leg does not remove the movement; it
 * removes half of it. The counterpart stays in its own account, still moving
 * that account's balance, with its link quietly nulled — an orphan that looks
 * like an ordinary transaction and reads as a real payment for as long as
 * nobody reconciles that account. One such stranded leg went unnoticed for
 * years and left an account out by five figures.
 *
 * The old confirmation said only "This action cannot be undone", which is true
 * and beside the point: the thing the user cannot undo is happening in an
 * account they are not looking at.
 *
 * Nothing is offered to delete on the user's behalf — cascading a delete into
 * another account without being asked would be worse than stranding a row. This
 * is consent, so it names the consequence and stops.
 */
export function describeDeleteStranding(
  transaction: Transaction | null | undefined,
  transactions: readonly Transaction[],
  openAccounts: readonly Account[]
): DeleteStranding | null {
  const otherSide = resolveTransferOtherSide(transaction, transactions, openAccounts);
  if (!otherSide || !transaction) {
    return null;
  }

  // "the account it faces" rather than a blank: a closed account is not in the
  // context's list, so its name genuinely is not available to print.
  const where = otherSide.accountName ? `in ${otherSide.accountName}` : 'in the account it faces';

  // The opposite side being one LINE of a split is worth saying, because what
  // survives is not a whole transaction the user can go and delete — the rest
  // of that split is other spending, and it stays.
  if (transaction.linkedTransferSplitId) {
    return {
      message: `This is one half of a transfer. Its other half is a single line inside a split transaction ${where}, and deleting this will leave that line linked to nothing — the split itself stays exactly as it is, still counted in that account's balance. Open it there to put it right.`,
      accountId: otherSide.accountId,
      transactionId: otherSide.transactionId,
    };
  }

  return {
    message: `This is one half of a transfer. Deleting it will leave the other half ${where}, still counted in that account's balance but no longer linked to anything. Delete that side too if you mean to remove the whole movement — this only removes one of them.`,
    accountId: otherSide.accountId,
    transactionId: otherSide.transactionId,
  };
}
