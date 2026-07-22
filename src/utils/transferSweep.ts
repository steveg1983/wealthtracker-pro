import { toDecimal } from './decimal';
import { calculateStringSimilarity } from './duplicateScan';
import type { Transaction } from '../types';

/**
 * Bulk transfer matching — find every unlinked equal-and-opposite pair in one
 * sweep, so a bank-feed history full of un-paired "Transfer (Online) to/from"
 * rows can be cleaned in one pass instead of one transaction at a time.
 *
 * The single-transaction path (utils/transferMatch) answers "is the other
 * side of THIS transfer already here?". This answers "which rows in my whole
 * history are obviously two sides of the same movement?" — the pairing rules
 * are deliberately strict, because a wrong link silently rewrites two
 * accounts' meaning:
 *
 *  - amounts are EXACTLY opposite (Decimal, no float slack) and non-zero;
 *  - the two sides are in DIFFERENT accounts;
 *  - dates within `windowDays` (bank clearing lag);
 *  - neither side already linked, a split parent, or typed 'transfer';
 *  - each row is used at most once — closest date wins, description
 *    similarity breaks ties, and a row with several equally-good candidates
 *    is reported as AMBIGUOUS rather than guessed at.
 *
 * Nothing is mutated here: the caller reviews, deselects, then applies.
 */

export interface TransferPairSuggestion {
  /** The money-out side. */
  outgoing: Transaction;
  /** The money-in side. */
  incoming: Transaction;
  /** Whole/fractional days between the two dates. */
  daysApart: number;
  /** 0–100 description similarity (tie-break/confidence only). */
  descriptionScore: number;
  /** True when other equally-close candidates existed for this row. */
  ambiguous: boolean;
}

export interface TransferSweepResult {
  suggestions: TransferPairSuggestion[];
  /** Rows considered (unlinked, uncategorised-or-not, non-split). */
  scanned: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;
export const SWEEP_WINDOW_DAYS = 4;

const pennies = (amount: number): number => toDecimal(amount).times(100).toDecimalPlaces(0).toNumber();

export function sweepTransferPairs(
  transactions: Transaction[],
  opts: { windowDays?: number; onlyUncategorised?: boolean; categoryIds?: Set<string> } = {}
): TransferSweepResult {
  const windowDays = opts.windowDays ?? SWEEP_WINDOW_DAYS;

  const eligible = transactions.filter(t => {
    if (t.isSplit) return false;
    if (t.linkedTransferId) return false;
    if (t.type === 'transfer') return false;
    if (toDecimal(t.amount).isZero()) return false;
    if (opts.onlyUncategorised) {
      const hasRealCategory = !!t.category && (!opts.categoryIds || opts.categoryIds.has(t.category));
      if (hasRealCategory) return false;
    }
    return true;
  });

  // Bucket by exact penny amount so each row only inspects its opposites.
  const byAmount = new Map<number, Transaction[]>();
  for (const t of eligible) {
    const key = pennies(t.amount);
    const list = byAmount.get(key);
    if (list) list.push(t);
    else byAmount.set(key, [t]);
  }

  const used = new Set<string>();
  const suggestions: TransferPairSuggestion[] = [];

  // Deterministic order: oldest first, so a re-run pairs identically.
  const ordered = [...eligible].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id)
  );

  for (const row of ordered) {
    if (used.has(row.id)) continue;
    const opposites = byAmount.get(-pennies(row.amount)) ?? [];
    const rowTime = new Date(row.date).getTime();

    const candidates = opposites
      .filter(o =>
        !used.has(o.id) &&
        o.id !== row.id &&
        o.accountId !== row.accountId &&
        Math.abs(new Date(o.date).getTime() - rowTime) <= windowDays * DAY_MS
      )
      .map(o => ({
        transaction: o,
        daysApart: Math.abs(new Date(o.date).getTime() - rowTime) / DAY_MS,
        descriptionScore: calculateStringSimilarity(row.description, o.description),
      }))
      .sort((a, b) => a.daysApart - b.daysApart || b.descriptionScore - a.descriptionScore);

    const best = candidates[0];
    if (!best) continue;

    // Ambiguous when an equally-good alternative exists — checked in BOTH
    // directions, because which side the sweep reaches first is an accident
    // of ordering: the row may have several candidate partners, or several
    // rows may be competing for the partner it chose.
    const equallyGood = (list: Array<{ daysApart: number; descriptionScore: number }>): boolean =>
      list.length > 1 &&
      list[1].daysApart === list[0].daysApart &&
      list[1].descriptionScore === list[0].descriptionScore;

    const partnerTime = new Date(best.transaction.date).getTime();
    const reverseCandidates = (byAmount.get(pennies(row.amount)) ?? [])
      .filter(o =>
        !used.has(o.id) &&
        o.id !== best.transaction.id &&
        o.accountId !== best.transaction.accountId &&
        Math.abs(new Date(o.date).getTime() - partnerTime) <= windowDays * DAY_MS
      )
      .map(o => ({
        daysApart: Math.abs(new Date(o.date).getTime() - partnerTime) / DAY_MS,
        descriptionScore: calculateStringSimilarity(best.transaction.description, o.description),
      }))
      .sort((a, b) => a.daysApart - b.daysApart || b.descriptionScore - a.descriptionScore);

    const ambiguous = equallyGood(candidates) || equallyGood(reverseCandidates);

    used.add(row.id);
    used.add(best.transaction.id);

    const rowIsOutgoing = toDecimal(row.amount).isNegative();
    suggestions.push({
      outgoing: rowIsOutgoing ? row : best.transaction,
      incoming: rowIsOutgoing ? best.transaction : row,
      daysApart: best.daysApart,
      descriptionScore: best.descriptionScore,
      ambiguous,
    });
  }

  return { suggestions, scanned: eligible.length };
}
