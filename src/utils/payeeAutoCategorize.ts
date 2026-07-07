import type { Transaction } from '../types';

/**
 * Payee normalization for auto-categorization matching. Mirrors the SQL side
 * (upper(btrim(description)) in import_bank_transactions_atomic) so client
 * propagation and server import prefill agree on what "the same payee" means.
 */
export const normalizePayee = (description: string): string => description.trim().toUpperCase();

/**
 * The bank-sync handler substitutes this literal for description-less rows
 * (api/banking/sync-transactions.ts). It is a sentinel, not a payee identity —
 * matching on it would fuse unrelated merchants into one mega-payee, so both
 * this helper and the SQL import prefill exclude it.
 */
export const FALLBACK_BANK_DESCRIPTION = 'BANK TRANSACTION';

/**
 * Find the transactions that should inherit a category when the user
 * categorizes one (Microsoft Money's payee memory): same account, same
 * direction (income/expense), same normalized description, currently
 * UNCATEGORIZED. Never returns transactions that already carry a category —
 * the user's explicit choices are never overwritten (the RPC re-enforces this
 * server-side) — and never the transaction being edited itself.
 */
export function findSamePayeeUncategorized(
  transactions: Transaction[],
  accountId: string,
  description: string,
  type: 'income' | 'expense',
  excludeId?: string
): string[] {
  const payee = normalizePayee(description);
  if (payee === '' || payee === FALLBACK_BANK_DESCRIPTION) {
    return [];
  }

  return transactions
    .filter(t =>
      t.accountId === accountId &&
      t.id !== excludeId &&
      t.type === type &&
      (!t.category || t.category.trim() === '') &&
      normalizePayee(t.description) === payee
    )
    .map(t => t.id);
}
