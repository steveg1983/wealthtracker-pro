/**
 * Single source of truth for transaction amount sign conventions.
 *
 * Money is stored SIGNED in the DB: expenses and outgoing transfers negative,
 * income and incoming transfers positive. Forms collect the magnitude (an
 * absolute value), so the sign must be applied at submit time.
 *
 * This lived inline (and divergently) in AddTransactionModal and
 * EditTransactionModal — the edit copy omitted the expense sign, storing
 * expenses as positive and double-swinging the balance. Centralising it here
 * removes that whole class of bug. Both modals call this.
 */

export type TransactionKind = 'income' | 'expense' | 'transfer';

/**
 * @param magnitude  the user-entered amount (sign ignored — abs is taken)
 * @param type       the resolved transaction type
 * @param isTransferOut  for transfers: true = money leaving this account
 *                       (negative), false = arriving (positive). Ignored for
 *                       non-transfers.
 */
export function signTransactionAmount(
  magnitude: number,
  type: TransactionKind,
  isTransferOut = true
): number {
  const abs = Math.abs(magnitude);
  // `|| 0` normalises -0 → 0 (a zero-magnitude expense would otherwise be -0,
  // which Object.is treats as distinct from 0).
  if (type === 'income') return abs;
  if (type === 'expense') return -abs || 0;
  // transfer
  return (isTransferOut ? -abs : abs) || 0;
}
