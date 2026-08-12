import { toDecimal } from './decimal';
import { calculateStringSimilarity } from './duplicateScan';
import {
  accountCurrencyIndex,
  compareCrossCurrencyCandidates,
  crossCurrencyCandidate,
  hasMultipleCurrencies,
  type AccountCurrencyIndex,
  type CrossCurrencyRateLookup,
} from './crossCurrencyMatch';
import type { CrossCurrency } from './crossCurrencyTransfer';
import type { Account, Transaction, TransactionSplit } from '../types';

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
  /**
   * Set only for a pair that crosses a CURRENCY boundary, oriented outgoing →
   * incoming: `from` is the currency the money left, `to` the currency it
   * arrived in. Its presence is what tells the review UI to show the boundary
   * on the row, because the two figures alone cannot say it — a bare
   * "−100.00 / +74.20" reads as a broken match rather than a conversion.
   */
  crossCurrency?: CrossCurrency;
  /** See crossCurrencyMatch. Sorting only, and only ever set alongside `crossCurrency`. */
  rateDivergence?: number;
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
    /**
     * The accounts, which is the only way to know what currency a row counts
     * in. Without them the cross-currency pass does not run at all and this
     * function behaves exactly as it did before that pass existed — the same
     * bargain `splits` strikes above.
     */
    accounts?: readonly Account[];
    /** A quote used to RANK cross-currency candidates. Never to exclude one. */
    rateLookup?: CrossCurrencyRateLookup;
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

  // The cross-currency pass, LAST of the three and additive on the same terms.
  // It shares `used` and runs after both passes above have taken what they
  // wanted, so every suggestion and every leg match they produced is exactly
  // what it would have been without this pass existing. It can only ever pair
  // rows that nothing else could use — which is also the honest description of
  // what it is for: −$100 and +£74.20 were invisible to both.
  const index = opts.accounts ? accountCurrencyIndex(opts.accounts) : null;
  //
  // APPENDED, never merged in by a re-sort: the same-currency suggestions keep
  // the exact positions they had, because the order this array comes out in is
  // observable and pinned by tests. The review UI applies its own ordering to
  // the rows it shows (compareRows in TransferSweepModal), so nothing on screen
  // depends on the cross-currency entries arriving at the end.
  if (index && hasMultipleCurrencies(index)) {
    suggestions.push(...sweepCrossCurrencyPairs(eligible, used, windowDays, index, opts.rateLookup));
  }

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

/**
 * Pair what is LEFT across a currency boundary.
 *
 * ── WHY THIS PASS CANNOT BUCKET BY AMOUNT, AND WHAT IT BUCKETS BY INSTEAD ────
 *
 * Both passes above find their candidates in O(1) by looking up the exact
 * opposite penny amount. Across a boundary there is no such key: the whole
 * point is that £74.20 is the opposite of $100.00, and the number that connects
 * them is a rate this file is not allowed to have an opinion about.
 *
 * So the index is the other fact a pair must satisfy — the DATE. Rows are
 * bucketed by calendar day and by sign, and a row consults only the ±window
 * days of buckets holding the opposite sign: nine buckets at the standard
 * window of four days. That keeps the pass linear in the leftovers rather than
 * quadratic, which matters because the rows reaching it are precisely the ones
 * nothing else could pair — on a long history that is a big pile.
 *
 * The pass is skipped outright for a single-currency book (see
 * `hasMultipleCurrencies`), which is most books, so none of this is paid for by
 * a ledger it cannot apply to.
 */
function sweepCrossCurrencyPairs(
  eligible: Transaction[],
  used: Set<string>,
  windowDays: number,
  index: AccountCurrencyIndex,
  rateLookup?: CrossCurrencyRateLookup
): TransferPairSuggestion[] {
  const dayOf = (t: Transaction): number => Math.floor(timeOf(t.date) / DAY_MS);
  const span = Math.ceil(windowDays);

  // Leftovers only, split by sign: a candidate must be opposite in sign, so the
  // two halves never look at themselves.
  const positives = new Map<number, Transaction[]>();
  const negatives = new Map<number, Transaction[]>();
  const remaining: Transaction[] = [];
  for (const t of eligible) {
    if (used.has(t.id)) continue;
    // A row in an account of unknown currency can pair with nothing here —
    // `crossCurrencyCandidate` would decline it — so it is not indexed either.
    if (!index.has(t.accountId)) continue;
    remaining.push(t);
    const bucket = toDecimal(t.amount).isNegative() ? negatives : positives;
    const day = dayOf(t);
    const list = bucket.get(day);
    if (list) list.push(t);
    else bucket.set(day, [t]);
  }
  if (remaining.length === 0) return [];

  /** Every leftover row of the OPPOSITE sign whose day is within the window. */
  const nearby = (row: Transaction): Transaction[] => {
    const bucket = toDecimal(row.amount).isNegative() ? positives : negatives;
    const day = dayOf(row);
    const found: Transaction[] = [];
    for (let d = day - span; d <= day + span; d += 1) {
      const list = bucket.get(d);
      if (list) found.push(...list);
    }
    return found;
  };

  /** One row's viable partner, with everything the ranking needs. */
  interface CrossCandidate {
    transaction: Transaction;
    pair: CrossCurrency;
    rateDivergence?: number;
    daysApart: number;
    descriptionScore: number;
  }

  /** The viable partners for `from`, ranked. `skipId` drops a known partner. */
  const rank = (from: Transaction, skipId?: string): CrossCandidate[] => {
    const fromTime = timeOf(from.date);
    return nearby(from)
      .flatMap<CrossCandidate>(other => {
        if (used.has(other.id) || other.id === skipId) return [];
        const daysApart = Math.abs(timeOf(other.date) - fromTime) / DAY_MS;
        if (daysApart > windowDays) return [];
        const match = crossCurrencyCandidate(from, other, index, rateLookup);
        if (!match) return [];
        return [{
          transaction: other,
          pair: match.pair,
          daysApart,
          descriptionScore: calculateStringSimilarity(from.description, other.description),
          ...(match.rateDivergence === undefined ? {} : { rateDivergence: match.rateDivergence }),
        }];
      })
      .sort(compareCrossCurrencyCandidates);
  };

  // Deterministic order, exactly as the pass above: oldest first, id as the
  // tie-break, so a re-run over unchanged data pairs identically.
  const ordered = [...remaining].sort(
    (a, b) => timeOf(a.date) - timeOf(b.date) || a.id.localeCompare(b.id)
  );

  const suggestions: TransferPairSuggestion[] = [];
  for (const row of ordered) {
    if (used.has(row.id)) continue;

    const candidates = rank(row);
    const best = candidates[0];
    if (!best) continue;

    // The reverse direction, on the same terms as the same-currency pass: other
    // free rows that could equally claim the partner this row chose. Which side
    // the sweep reaches first is an accident of ordering, so a tie is only
    // honest if it is checked from both ends. `row` itself is still unused and
    // therefore in this list, so the top two being level means a genuine tie.
    const partner = best.transaction;
    const rivals = rank(partner, partner.id);

    used.add(row.id);
    used.add(partner.id);

    const rowIsOutgoing = toDecimal(row.amount).isNegative();
    // `match.pair` is oriented row → partner. The suggestion is oriented
    // outgoing → incoming, which is the same thing only when the row IS the
    // outgoing side; otherwise the pair is read the other way round, so that
    // `from` always names the currency the money actually left.
    const pair = rowIsOutgoing
      ? best.pair
      : { from: best.pair.to, to: best.pair.from };

    suggestions.push({
      outgoing: rowIsOutgoing ? row : partner,
      incoming: rowIsOutgoing ? partner : row,
      daysApart: best.daysApart,
      descriptionScore: best.descriptionScore,
      ambiguous: equallyGoodCrossCurrency(candidates) || equallyGoodCrossCurrency(rivals),
      crossCurrency: pair,
      ...(best.rateDivergence === undefined ? {} : { rateDivergence: best.rateDivergence }),
    });
  }

  return suggestions;
}

/**
 * `equallyGood`, for a list ranked with the cross-currency comparator.
 *
 * The same-currency version compares the two fields it sorts on. This one has
 * to consult the comparator itself, because a third field sits between them and
 * "the top two are indistinguishable" must mean indistinguishable to the thing
 * that ordered them — otherwise two candidates the rate cleanly separates would
 * still be flagged ambiguous, and the flag would stop meaning anything.
 */
const equallyGoodCrossCurrency = (
  list: Array<{ daysApart: number; rateDivergence?: number; descriptionScore: number }>
): boolean => list.length > 1 && compareCrossCurrencyCandidates(list[0], list[1]) === 0;
