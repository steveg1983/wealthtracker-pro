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
   * list). Closed accounts have no register, so the jump cannot be taken.
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
