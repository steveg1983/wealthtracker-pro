import { toDecimal } from './decimal';
import { releaseTypeFor } from './transferSurvivorRelease';
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
  /** The survivor's account name when it is known — only open accounts have one here. */
  accountName?: string;
  /**
   * The other half AS A ROW, when it is loaded and can safely be deleted
   * alongside this one — and null when it cannot, which is what decides whether
   * "Delete both sides" is offered at all.
   *
   * Null in three cases, each for its own reason:
   *  - the other half is one LINE of a split (`linkedTransferSplitId`, either
   *    direction): deleting "both" would mean reaching into somebody else's
   *    split, where the rest of the lines are unrelated spending that stays;
   *  - the other half is a SPLIT PARENT: deleting it takes every one of its
   *    lines with it, which is more than the user asked for and is exactly what
   *    the bulk delete refuses to do unasked;
   *  - the other half is not loaded (it usually sits in a closed account). An
   *    offer to delete a row nobody can see is a promise about its contents
   *    that cannot be kept.
   */
  deletableOtherSide: Transaction | null;
}

/**
 * What deleting this row would do to the OTHER side of its transfer — or null
 * when there is no other side and there is therefore nothing extra to say.
 *
 * WHY the confirmation needs this: `transactions_linked_transfer_id_fkey` is
 * ON DELETE SET NULL, and `delete_transaction_atomic` removes one row and
 * reverses one balance. So deleting one leg does not remove the movement; it
 * removes half of it. The counterpart stays in its own account, still moving
 * that account's balance — an orphan that looks like an ordinary transaction
 * and reads as a real payment for as long as nobody reconciles that account.
 * One such stranded leg went unnoticed for years and left an account out by
 * five figures.
 *
 * The old confirmation said only "This action cannot be undone", which is true
 * and beside the point: the thing the user cannot undo is happening in an
 * account they are not looking at.
 *
 * ─ WHAT THE SURVIVOR BECOMES, AND WHY THIS SAYS SO ─────────────────────────
 * It no longer stays a transfer. A transfer must have another side or it is not
 * one, so deleting a leg RELEASES the survivor: money-out becomes a plain
 * expense, money-in plain income, the To/From category is cleared and the row
 * lands in the review band (utils/transferSurvivorRelease.ts holds that rule and
 * AppContextSupabase.deleteTransaction is the one place it is applied). This
 * sentence has to describe that, because it is what the user will find when
 * they go and look — and because the same sentence is what the BULK delete
 * confirmation shows, row by row, where there are no buttons to explain it.
 *
 * It deliberately mentions no buttons for that reason. The choice between one
 * side and both belongs to the dialog that offers it.
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
  const otherRow = transactions.find(t => t.id === otherSide.transactionId) ?? null;

  // The opposite side being one LINE of a split is worth saying, because what
  // survives is not a whole transaction the user can go and delete — the rest
  // of that split is other spending, and it stays. Nor can it be released: a
  // split's filing lives in its lines, and that line is still a real leg of the
  // split it belongs to.
  if (transaction.linkedTransferSplitId) {
    return {
      message: `This is one half of a transfer. Its other half is a single line inside a split transaction ${where}, and deleting this will leave that line linked to nothing — the split itself stays exactly as it is, still counted in that account's balance. Open it there to put it right.`,
      accountId: otherSide.accountId,
      transactionId: otherSide.transactionId,
      ...(otherSide.accountName ? { accountName: otherSide.accountName } : {}),
      deletableOtherSide: null,
    };
  }

  // Which way the survivor's money runs, so the sentence can name what it will
  // become. Read from the row itself when it is loaded; otherwise from this
  // row's amount negated, since a linked pair's two legs are opposite — that
  // being what makes them a transfer.
  const survivorAmount = otherRow ? otherRow.amount : toDecimal(transaction.amount).negated().toNumber();
  const becomes = releaseTypeFor(survivorAmount) === 'expense' ? 'payment' : 'deposit';

  const deletableOtherSide =
    otherRow && otherRow.isSplit !== true && !otherRow.linkedTransferSplitId ? otherRow : null;

  return {
    message: `This is one half of a transfer. Deleting it will leave the other half ${where}, still counted in that account's balance — it stops being a transfer there and becomes an uncategorised ${becomes} waiting to be filed.`,
    accountId: otherSide.accountId,
    transactionId: otherSide.transactionId,
    ...(otherSide.accountName ? { accountName: otherSide.accountName } : {}),
    deletableOtherSide,
  };
}
