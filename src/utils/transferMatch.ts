import { toDecimal } from './decimal';
import { calculateStringSimilarity } from './duplicateScan';
import type { Transaction, Category } from '../types';

/**
 * Transfer matching (the Microsoft Money model): when a transaction is filed
 * under a "To/From B" category, look for its opposite side already sitting in
 * account B before creating one.
 *
 * A candidate must be watertight on the numbers — the amount is EXACTLY the
 * source negated (Decimal comparison, no float slack) — and close in time
 * (bank clearing lag means the two sides rarely post the same day). The
 * description is deliberately only a tie-breaker: the two banks almost never
 * describe the same movement the same way ("TRANSFER TO 5755" vs "FASTER
 * PAYMENT RECEIVED").
 */
export interface TransferCandidate {
  transaction: Transaction;
  /** Whole/fractional days between the two sides' dates. */
  daysApart: number;
  /** 0–100 similarity of the two descriptions (tie-breaking only). */
  descriptionScore: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export const TRANSFER_MATCH_WINDOW_DAYS = 4;

export function findTransferCandidates(
  transactions: Transaction[],
  source: Transaction,
  targetAccountId: string,
  windowDays: number = TRANSFER_MATCH_WINDOW_DAYS
): TransferCandidate[] {
  const sourceAmount = toDecimal(source.amount);
  if (sourceAmount.isZero()) {
    return [];
  }
  const oppositeAmount = sourceAmount.negated();
  const sourceTime = new Date(source.date).getTime();

  const candidates: TransferCandidate[] = [];
  for (const transaction of transactions) {
    if (transaction.accountId !== targetAccountId) continue;
    if (transaction.id === source.id) continue;
    // A split parent cannot be a transfer, and an already-linked side is taken.
    if (transaction.isSplit) continue;
    if (transaction.linkedTransferId) continue;
    if (!toDecimal(transaction.amount).equals(oppositeAmount)) continue;

    const daysApart = Math.abs(new Date(transaction.date).getTime() - sourceTime) / DAY_MS;
    if (daysApart > windowDays) continue;

    candidates.push({
      transaction,
      daysApart,
      descriptionScore: calculateStringSimilarity(source.description, transaction.description),
    });
  }

  // Closest date wins; description similarity breaks ties.
  candidates.sort((a, b) => a.daysApart - b.daysApart || b.descriptionScore - a.descriptionScore);
  return candidates;
}

/** The account-managed "To/From <account>" category, if the account has one. */
export function transferCategoryFor(categories: Category[], accountId: string): Category | undefined {
  return categories.find(c => c.isTransferCategory === true && c.accountId === accountId);
}
