import type { Transaction } from '../types';
import { calculateSimilarity, findDuplicateGroups, type DuplicateThresholds } from './duplicateScan';

/**
 * The duplicate sweep: which rows look like the same payment recorded twice,
 * and which of them it is SAFE to delete.
 *
 * The scanning itself is duplicateScan's (date-window indexing, Levenshtein
 * short-circuits — the reason a 16,000-row history does not freeze the main
 * thread). This module adds the two things the scanner deliberately does not
 * know about:
 *
 *  1. ONE ACCOUNT AT A TIME. Two equal, same-day, same-payee rows in DIFFERENT
 *     accounts are not a duplicate, they are a transfer — somebody else's job
 *     (utils/transferSweep), and offering to delete one would destroy half of a
 *     movement of money. Scanning per account is also strictly cheaper: the
 *     index is rebuilt over a fraction of the history each time.
 *
 *  2. WHETHER THE ROW CAN BE DELETED AT ALL. delete_transaction_atomic removes
 *     the row and reverses its balance, and stops there — it does not chase the
 *     other side of a transfer, and a split parent's lines vanish with it by
 *     foreign key. So three shapes of row must never be offered for deletion;
 *     see DeleteBlock below. The offer is refused in the UI with the reason
 *     said out loud, rather than being quietly hidden: the user still needs to
 *     know these two rows look identical.
 *
 * Thresholds are fixed at "to the penny" on amount and 80% on total similarity.
 * The amount is deliberately NOT adjustable: a knob that lets £100.00 match
 * £99.00 turns a delete tool into a way to lose a real payment. Only the date
 * window moves, because import overlaps genuinely land days apart.
 */

/** Money must match to the penny; anything looser is not a duplicate. */
const AMOUNT_THRESHOLD = 0.01;
/**
 * Above 70 the scan can prune by date window (see duplicateScan) — the reason
 * this stays high, besides being the point at which descriptions genuinely
 * read as the same payee.
 */
const SIMILARITY_THRESHOLD = 80;

/** Two rows in one account that look like the same movement recorded twice. */
export interface DuplicateCandidate {
  /** The row the scan seeded the group with. */
  a: Transaction;
  /** The row it matched. Interchangeable with `a` — see suggestionDismissals. */
  b: Transaction;
  /** 0–100: how alike the two are on date, amount and description together. */
  score: number;
  /** Whole/fractional days between the two dates. */
  daysApart: number;
}

/**
 * Why a row must not be deleted. Every one of these is a case where deleting
 * this row would leave something else in the ledger pointing at nothing.
 */
export type DeleteBlock =
  /** Half of a linked transfer: the row on the other side would be stranded. */
  | 'linked-transfer'
  /** The opposite side of one LINE of a split: that line would be stranded. */
  | 'split-line-counterpart'
  /** A split parent: its lines go with it, and any leg among them is a transfer. */
  | 'split-parent';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Why this row cannot be deleted, or null when it can.
 *
 * Order matters: a row whose opposite is a split LINE carries BOTH
 * linkedTransferSplitId and linkedTransferId (the latter pointing at the split
 * parent), and the split-line case is the more precise thing to say.
 */
export function deleteBlockOf(transaction: Transaction): DeleteBlock | null {
  if (transaction.linkedTransferSplitId) return 'split-line-counterpart';
  if (transaction.linkedTransferId) return 'linked-transfer';
  if (transaction.isSplit) return 'split-parent';
  return null;
}

/**
 * Candidate duplicates across the whole history, account by account.
 *
 * Archived rows are excluded: they are out of the live register by the user's
 * own choice, still counted in every balance, and offering to delete one would
 * be acting on something they cannot see.
 *
 * A three-way duplicate (A, B, C) comes back as the two pairs the scan found —
 * A/B and A/C — not as three. Deleting A leaves B and C, and the next scan
 * offers B/C: one decision at a time, each with both of its rows in front of
 * the user.
 */
export function findDuplicateCandidates(
  transactions: Transaction[],
  options: { windowDays: number }
): DuplicateCandidate[] {
  const thresholds: DuplicateThresholds = {
    dateThreshold: options.windowDays,
    amountThreshold: AMOUNT_THRESHOLD,
    similarityThreshold: SIMILARITY_THRESHOLD,
  };

  const byAccount = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.archived === true) continue;
    const rows = byAccount.get(transaction.accountId);
    if (rows) rows.push(transaction);
    else byAccount.set(transaction.accountId, [transaction]);
  }

  const candidates: DuplicateCandidate[] = [];
  for (const rows of byAccount.values()) {
    if (rows.length < 2) continue;
    for (const group of findDuplicateGroups(rows, thresholds)) {
      for (const other of group.potential) {
        candidates.push({
          a: group.original,
          b: other,
          score: calculateSimilarity(group.original, other, thresholds).totalScore,
          daysApart: Math.abs(
            new Date(group.original.date).getTime() - new Date(other.date).getTime()
          ) / DAY_MS,
        });
      }
    }
  }
  return candidates;
}
