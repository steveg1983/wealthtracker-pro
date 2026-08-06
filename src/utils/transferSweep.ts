import { toDecimal } from './decimal';
import { calculateStringSimilarity } from './duplicateScan';
import type { Transaction, TransactionSplit } from '../types';

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
 * ── The second pass: one LINE of a split ────────────────────────────────────
 *
 * A whole-transaction pass cannot see the movement the owner actually makes:
 * £35,000 arrives, £30,000 of it settles a loan and £5,000 is interest. The
 * parent is £35,000 and the row waiting in the loan account is £30,000, so
 * NOTHING about the two rows matches — the match is between the £30,000 LINE
 * and that row (the model in 20260720120000: a split line carrying
 * transfer_account_id with a NULL linked_transfer_id is an unmatched leg).
 *
 * That pass is strictly additive. It runs AFTER the whole-transaction pass,
 * over the rows that pass left over, so every pair above is exactly what it
 * was before line matching existed; and it applies the same candidate rules,
 * plus the two the RPC behind it (link_split_line_transfer) refuses by name:
 * the row must sit in the account the LINE names, and must not be archived.
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

/**
 * One LINE of a split matched to the transaction that is its other side.
 *
 * Carries everything an offer needs to be judged and acted on: the line
 * (`link_split_line_transfer` is keyed by its id), the parent it belongs to —
 * whose date, payee and account are the line's — and the row over there.
 */
export interface SplitLegSuggestion {
  /** The unmatched leg: `transferAccountId` set, `linkedTransferId` absent. */
  split: TransactionSplit;
  /** The split parent. Its total legitimately differs from the line's amount. */
  parent: Transaction;
  /** The free row in the account the LINE names, exactly opposite the LINE. */
  candidate: Transaction;
  /** Whole/fractional days between the parent's date and the candidate's. */
  daysApart: number;
  /** 0–100 description similarity (tie-break/confidence only). */
  descriptionScore: number;
  /** True when other equally-close rows — or other lines — competed for this match. */
  ambiguous: boolean;
}

export interface TransferSweepResult {
  suggestions: TransferPairSuggestion[];
  /** Line-level matches, found after (and never instead of) the pairs above. */
  legSuggestions: SplitLegSuggestion[];
  /** Rows considered (unlinked, uncategorised-or-not, non-split). */
  scanned: number;
  /** Unmatched split legs considered. */
  legsScanned: number;
}

/** A split line that says "this much went to that account", with no row there yet. */
export interface UnmatchedSplitLeg {
  split: TransactionSplit;
  parent: Transaction;
  /** The account the line names — `split.transferAccountId`, resolved non-null. */
  target: string;
  /** The parent's date in millis: a line has no date of its own. */
  time: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;
export const SWEEP_WINDOW_DAYS = 4;

const pennies = (amount: number): number => toDecimal(amount).times(100).toDecimalPlaces(0).toNumber();

const timeOf = (date: Date | string): number => new Date(date).getTime();

/**
 * Ambiguous when an equally-good alternative exists — checked in BOTH
 * directions by every caller, because which side the sweep reaches first is an
 * accident of ordering: a row may have several candidate partners, or several
 * rows may be competing for the partner it chose.
 */
const equallyGood = (list: Array<{ daysApart: number; descriptionScore: number }>): boolean =>
  list.length > 1 &&
  list[1].daysApart === list[0].daysApart &&
  list[1].descriptionScore === list[0].descriptionScore;

/**
 * Every split LINE that declares a transfer target and has no counterpart yet,
 * oldest parent first so a re-run considers them in the same order.
 *
 * Excluded before anything else looks at them: a line whose parent is not in
 * this view (nothing to date it by), one whose parent is archived (out of the
 * live register — the stranded classifier's rule), one pointing back at its
 * own account and one for £0 — the last two being refusals of
 * link_split_line_transfer, so an offer built on them could never be accepted.
 */
export function unmatchedSplitLegs(
  splits: TransactionSplit[],
  byId: Map<string, Transaction>
): UnmatchedSplitLeg[] {
  const legs: UnmatchedSplitLeg[] = [];
  for (const split of splits) {
    const target = split.transferAccountId;
    if (!target || split.linkedTransferId) continue;
    const parent = byId.get(split.transactionId);
    if (!parent || parent.archived === true) continue;
    if (target === parent.accountId) continue;
    if (toDecimal(split.amount).isZero()) continue;
    legs.push({ split, parent, target, time: timeOf(parent.date) });
  }
  return legs.sort(
    (a, b) =>
      a.time - b.time ||
      a.parent.id.localeCompare(b.parent.id) ||
      a.split.sortOrder - b.split.sortOrder ||
      a.split.id.localeCompare(b.split.id)
  );
}

export function sweepTransferPairs(
  transactions: Transaction[],
  opts: {
    windowDays?: number;
    onlyUncategorised?: boolean;
    categoryIds?: Set<string>;
    /**
     * The user's split lines. Without them the sweep behaves exactly as it did
     * before line matching existed — no leg is looked at, and `legSuggestions`
     * comes back empty.
     */
    splits?: TransactionSplit[];
  } = {}
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

  // The line-level pass, over what the pass above left behind. It shares the
  // `used` set and runs strictly second, so it can only ever consume rows no
  // pair wanted — every suggestion above is what it would have been without
  // this pass existing.
  const splits = opts.splits ?? [];
  const legs = splits.length > 0
    ? unmatchedSplitLegs(splits, new Map(transactions.map(t => [t.id, t])))
    : [];
  const legSuggestions = legs.length > 0
    ? sweepSplitLegs(legs, eligible, used, windowDays)
    : [];

  return { suggestions, legSuggestions, scanned: eligible.length, legsScanned: legs.length };
}

/**
 * Match each unmatched leg to the free row that is exactly the LINE's
 * opposite, in exactly the account the line names.
 *
 * `eligible` is the whole-transaction pass's own candidate pool, so a line
 * competes for rows on identical terms (unlinked, not typed 'transfer', not a
 * split parent, uncategorised when the caller asked for that, never used
 * twice). Two rules are added, both of them refusals of
 * link_split_line_transfer rather than opinions of this file: an archived row
 * cannot be paired, and neither can one already pinned as some other line's
 * opposite.
 */
function sweepSplitLegs(
  legs: UnmatchedSplitLeg[],
  eligible: Transaction[],
  used: Set<string>,
  windowDays: number
): SplitLegSuggestion[] {
  // Free rows by account + exact penny amount: a line only ever looks in the
  // one account it names.
  const byAccountAmount = new Map<string, Transaction[]>();
  for (const t of eligible) {
    if (t.archived === true || t.linkedTransferSplitId) continue;
    const key = `${t.accountId}|${pennies(t.amount)}`;
    const list = byAccountAmount.get(key);
    if (list) list.push(t);
    else byAccountAmount.set(key, [t]);
  }

  const usedLegs = new Set<string>();
  const suggestions: SplitLegSuggestion[] = [];

  for (const leg of legs) {
    const candidates = (byAccountAmount.get(`${leg.target}|${-pennies(leg.split.amount)}`) ?? [])
      .filter(t => !used.has(t.id) && Math.abs(timeOf(t.date) - leg.time) <= windowDays * DAY_MS)
      .map(t => ({
        transaction: t,
        daysApart: Math.abs(timeOf(t.date) - leg.time) / DAY_MS,
        // The counterpart of a leg carries the PARENT's payee (that is what
        // set_transaction_splits_with_legs writes), so the parent's
        // description is the line's for comparison purposes.
        descriptionScore: calculateStringSimilarity(leg.parent.description, t.description),
      }))
      .sort((a, b) => a.daysApart - b.daysApart || b.descriptionScore - a.descriptionScore);

    const best = candidates[0];
    if (!best) continue;

    // The reverse direction: other unmatched lines competing for the row this
    // one chose. `leg` itself is still unused and therefore in this list, so
    // the top two being level means a genuine tie.
    const candidateTime = timeOf(best.transaction.date);
    const rivals = legs
      .filter(other =>
        !usedLegs.has(other.split.id) &&
        other.target === best.transaction.accountId &&
        pennies(other.split.amount) === -pennies(best.transaction.amount) &&
        Math.abs(other.time - candidateTime) <= windowDays * DAY_MS
      )
      .map(other => ({
        daysApart: Math.abs(other.time - candidateTime) / DAY_MS,
        descriptionScore: calculateStringSimilarity(best.transaction.description, other.parent.description),
      }))
      .sort((a, b) => a.daysApart - b.daysApart || b.descriptionScore - a.descriptionScore);

    used.add(best.transaction.id);
    usedLegs.add(leg.split.id);

    suggestions.push({
      split: leg.split,
      parent: leg.parent,
      candidate: best.transaction,
      daysApart: best.daysApart,
      descriptionScore: best.descriptionScore,
      ambiguous: equallyGood(candidates) || equallyGood(rivals),
    });
  }

  return suggestions;
}
