import { Decimal, toDecimal, type DecimalInstance } from './decimal';
import { deriveRate } from './fx';
import { crossedCurrencyPair, type CrossCurrency } from './crossCurrencyTransfer';
import type { Account, Transaction } from '../types';

/**
 * When two rows in DIFFERENT currencies may be offered as the two sides of one
 * transfer — and in what order the offers should be listed.
 *
 * ── WHY THE MATCHERS NEEDED CHANGING AT ALL ─────────────────────────────────
 *
 * Every candidate matcher in the product buckets rows by exact penny amount:
 * `byAmount.get(-pennies(row.amount))` in transferSweep, `allByAmount` in
 * strandedTransfers, an exact negated Decimal compare in transferMatch. A
 * −$100.00 row and the +£74.20 that is its other side land in buckets that
 * never meet, so no matcher could offer that pair — not because anything
 * refused it, but because nothing ever looked.
 *
 * The engines now DO accept it. `link_transfer_pair` splits its refusal 5 by
 * whether the two accounts share a currency: same currency is unchanged to the
 * penny, different currencies need only both sides non-zero and OPPOSITE IN
 * SIGN, "with no constraint on magnitude, because the ratio between the
 * magnitudes *is* the achieved rate and this engine holds no opinion about FX".
 * That sentence is the whole specification of {@link crossCurrencyCandidate},
 * and it is deliberately copied rather than paraphrased: a matcher that offered
 * a pair the engine then refused would be a dialog that fails on confirm.
 *
 * ── THE WINDOW IS NOT A NEW ONE ─────────────────────────────────────────────
 *
 * Nothing here has a window of its own. Each caller passes the window it was
 * already using (SWEEP_WINDOW_DAYS, TRANSFER_MATCH_WINDOW_DAYS — both 4), so a
 * currency boundary changes WHICH rows may pair, never HOW LONG a bank is
 * allowed to take. A conversion clears no slower than a domestic payment.
 *
 * ── A MARKET RATE MAY SORT. IT MAY NEVER FILTER. ────────────────────────────
 *
 * This is the rule that governs {@link CrossCurrencyRateLookup} and it is not a
 * style preference. A real conversion happens at the rate the BANK gave on the
 * day, including its spread, its fees, and whatever the market did that
 * afternoon; a mid-market quote from a free API is an opinion about what that
 * should have been. On a volatile day — or for a currency the provider tracks
 * badly, or a transfer whose fee was a third of the amount — the two disagree
 * wildly, and the pair is still real. So a divergent rate may push a candidate
 * DOWN a list the user is reading, and may never remove it from one. There is
 * no threshold constant in this file, and adding one would be the bug.
 */

/** How a caller answers "what is one unit of `from` worth in `to`?", if it can. */
export type CrossCurrencyRateLookup = (from: string, to: string) => DecimalInstance | null;

/**
 * A pair that crosses a currency boundary, and how far its implied rate sits
 * from a quoted one.
 */
export interface CrossCurrencyMatch {
  /** The boundary itself: the source's currency and the candidate's. */
  pair: CrossCurrency;
  /**
   * How many TIMES off the rate these two amounts imply is from the quoted
   * rate for the pair — 1 exactly when they agree, 2 when the implied rate is
   * double or half the quote. Symmetric, so being 2× out is ranked the same
   * whichever way round it is wrong.
   *
   * `undefined` when no quote was available (offline, an untracked pair, or a
   * caller that passed no lookup at all). Undefined divergence never demotes a
   * candidate: it means the app has nothing to say, not that the pair is
   * suspect. See the header — this figure sorts, and only sorts.
   */
  rateDivergence?: number;
}

/** Account id → the currency it counts in, built once per sweep. */
export type AccountCurrencyIndex = ReadonlyMap<string, string>;

export function accountCurrencyIndex(accounts: readonly Account[]): AccountCurrencyIndex {
  const index = new Map<string, string>();
  for (const account of accounts) {
    if (account.currency) index.set(account.id, account.currency);
  }
  return index;
}

/**
 * Does this book have more than one currency in it at all?
 *
 * The short circuit every caller checks first. A single-currency ledger — which
 * is nearly every ledger, and certainly the owner's for most of its history —
 * can produce no cross-currency candidate by definition, so the extra pass is
 * skipped outright rather than run to find nothing. Without this the sweep
 * would pay for a feature that cannot apply to it on every run.
 */
export function hasMultipleCurrencies(index: AccountCurrencyIndex): boolean {
  let first: string | undefined;
  for (const currency of index.values()) {
    if (first === undefined) first = currency;
    else if (currency !== first) return true;
  }
  return false;
}

/**
 * Both non-zero and pointing opposite ways — the engine's
 * `transfer::are_opposite_in_sign`, in Decimal.
 *
 * Same money in both directions is not a transfer, it is two receipts; and a
 * zero side is refused across a currency boundary exactly as it is within one
 * (there is no rate at which zero becomes something).
 */
export function oppositeInSign(
  first: DecimalInstance | number,
  second: DecimalInstance | number
): boolean {
  const a = toDecimal(first);
  const b = toDecimal(second);
  if (a.isZero() || b.isZero()) return false;
  return a.isNegative() !== b.isNegative();
}

/**
 * Whether `candidate` may be offered as the other side of `source`, when the
 * two sit in accounts that count in different currencies.
 *
 * Returns `null` — not offered — when the two accounts share a currency or
 * either currency is unknown. That last case is the conservative half of
 * `crossedCurrencyPair` doing its job: a currency nobody can establish is not
 * evidence that a conversion happened, so the strict same-amount rules stay in
 * force and this pass declines to speak.
 *
 * NO AMOUNT TEST BEYOND SIGN. It is tempting to want one — a −£10 row matching
 * a +$14,000 row looks absurd — but every threshold that would exclude it is a
 * claim about an exchange rate, and this module is not allowed to make one. The
 * absurd pair is offered LAST instead, which is what {@link compareCrossCurrencyCandidates}
 * is for.
 */
export function crossCurrencyCandidate(
  source: Pick<Transaction, 'amount' | 'accountId'>,
  candidate: Pick<Transaction, 'amount' | 'accountId'>,
  index: AccountCurrencyIndex,
  rateLookup?: CrossCurrencyRateLookup
): CrossCurrencyMatch | null {
  if (source.accountId === candidate.accountId) return null;
  const pair = crossedCurrencyPair(
    index.get(source.accountId),
    index.get(candidate.accountId)
  );
  if (!pair) return null;
  if (!oppositeInSign(source.amount, candidate.amount)) return null;

  return { pair, rateDivergence: rateDivergenceOf(source.amount, candidate.amount, pair, rateLookup) };
}

/**
 * Where a candidate with no quote sits among candidates that have one.
 *
 * A divergence of 1 is a perfect match and the floor of the scale, so any
 * figure above this is a pair the quote positively disagrees with, and anything
 * below it is one the quote broadly supports. Ranking the unquoted here is the
 * only choice that treats "we could not ask" as neither evidence for nor
 * against — and it costs nothing on the common path, where either every
 * candidate has a quote or none does.
 */
const NEUTRAL_DIVERGENCE = 1.5;

/**
 * How far the rate these two amounts imply sits from the quoted one.
 *
 * Both directions of the ratio are considered and the larger is returned, so
 * "half the quoted rate" and "twice the quoted rate" score identically — a
 * plain difference would rank one of them as the better match purely because
 * division is not symmetric.
 *
 * Every intermediate step is Decimal: the implied rate comes from
 * {@link deriveRate}, which is the same function the linking seam uses to stamp
 * `metadata.fx`, so a pair's rank and its eventual receipt cannot disagree
 * about what rate it implied. The single `toNumber` at the end is on a
 * dimensionless ranking scalar, never on money.
 */
function rateDivergenceOf(
  sourceAmount: number,
  candidateAmount: number,
  pair: CrossCurrency,
  rateLookup?: CrossCurrencyRateLookup
): number | undefined {
  if (!rateLookup) return undefined;

  const quoted = rateLookup(pair.from, pair.to);
  if (!quoted || !quoted.isFinite() || quoted.isZero() || quoted.isNegative()) return undefined;

  const implied = deriveRate(sourceAmount, candidateAmount);
  if (!implied.ok || implied.value.isZero()) return undefined;

  const ratio = implied.value.dividedBy(quoted);
  if (ratio.isZero()) return undefined;
  const divergence = ratio.lessThan(1) ? new Decimal(1).dividedBy(ratio) : ratio;
  return divergence.toNumber();
}

/**
 * The order cross-currency candidates are offered in: DATE FIRST.
 *
 * Date proximity leads because it is the only evidence here that is a fact
 * about the two rows rather than an opinion about a market. A conversion that
 * cleared the same day is a better candidate than one four days out, whatever
 * either implies about the rate.
 *
 * Rate divergence breaks the tie, and this is where a quote earns its keep: on
 * a day with several opposite-signed rows in a foreign account, the one whose
 * magnitude actually looks like a conversion should be the one preselected. A
 * candidate with no divergence figure at all sorts as neutral — after those
 * that match the quote, before those that plainly do not — because "no quote"
 * is not evidence in either direction.
 *
 * Description similarity comes last, as it does in every other matcher here:
 * two banks almost never describe the same movement the same way.
 */
export function compareCrossCurrencyCandidates(
  a: { daysApart: number; rateDivergence?: number; descriptionScore: number },
  b: { daysApart: number; rateDivergence?: number; descriptionScore: number }
): number {
  if (a.daysApart !== b.daysApart) return a.daysApart - b.daysApart;

  const divergenceA = a.rateDivergence ?? NEUTRAL_DIVERGENCE;
  const divergenceB = b.rateDivergence ?? NEUTRAL_DIVERGENCE;
  if (divergenceA !== divergenceB) return divergenceA - divergenceB;

  return b.descriptionScore - a.descriptionScore;
}
