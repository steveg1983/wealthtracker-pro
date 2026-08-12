import { toDecimal } from './decimal';
import { calculateStringSimilarity } from './duplicateScan';
import {
  accountCurrencyIndex,
  compareCrossCurrencyCandidates,
  crossCurrencyCandidate,
  type CrossCurrencyRateLookup,
} from './crossCurrencyMatch';
import { crossedCurrencyPair, type CrossCurrency } from './crossCurrencyTransfer';
import type { Transaction, Category, Account } from '../types';

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
  /**
   * Set when this candidate sits across a CURRENCY boundary — the source's
   * currency and the candidate's. Absent for the ordinary same-currency match,
   * so `crossCurrency` being present is exactly the question the UI asks before
   * showing the boundary on the row.
   */
  crossCurrency?: CrossCurrency;
  /** See crossCurrencyMatch. Sorting only, and only ever set alongside `crossCurrency`. */
  rateDivergence?: number;
}

/**
 * What this matcher needs in order to consider a candidate in ANOTHER currency.
 *
 * A fifth parameter rather than a reshaped fourth, deliberately: `windowDays`
 * has been the fourth positional argument since this function existed, and the
 * behaviour of every existing call had to stay identical to the character. A
 * caller that passes none of this gets precisely the matcher it had before.
 */
export interface TransferMatchOptions {
  /**
   * The accounts, so the two currencies can be established. Without them no
   * currency is knowable, and — per `crossedCurrencyPair` — an unknown currency
   * reads as "same", which keeps the exact-amount rule in force.
   */
  accounts?: readonly Account[];
  /** A quote for ranking cross-currency candidates. Never filters: see crossCurrencyMatch. */
  rateLookup?: CrossCurrencyRateLookup;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export const TRANSFER_MATCH_WINDOW_DAYS = 4;

/**
 * ── ONE ACCOUNT, TWO POSSIBLE RULES ─────────────────────────────────────────
 *
 * This matcher looks in exactly one named account, because the user has already
 * said where the money went. So whether a currency boundary is being crossed is
 * a property of the CALL, not of each candidate: both currencies are read once,
 * and the rule that applies to every row in the list follows from them.
 *
 * Same currency (or either unknown, or no accounts given): the amount must be
 * exactly the source negated, as it always has been.
 *
 * Different currencies: opposite in sign and non-zero, with no constraint on
 * magnitude — the engine's own rule for a link across a boundary. Note that the
 * exact-opposite amount still qualifies, because it is opposite in sign; it
 * simply stops being privileged, which is right. Two real conversions almost
 * never produce equal magnitudes, and when they do it is a coincidence rather
 * than evidence.
 */
export function findTransferCandidates(
  transactions: Transaction[],
  source: Transaction,
  targetAccountId: string,
  windowDays: number = TRANSFER_MATCH_WINDOW_DAYS,
  options: TransferMatchOptions = {}
): TransferCandidate[] {
  const sourceAmount = toDecimal(source.amount);
  if (sourceAmount.isZero()) {
    return [];
  }
  const oppositeAmount = sourceAmount.negated();
  const sourceTime = new Date(source.date).getTime();

  // Read once, for the whole call. `undefined` on either side means the strict
  // rule below applies, which is the safe direction.
  const accounts = options.accounts;
  const crossed = accounts
    ? crossedCurrencyPair(
        accounts.find(a => a.id === source.accountId)?.currency,
        accounts.find(a => a.id === targetAccountId)?.currency
      )
    : null;
  const index = crossed && accounts ? accountCurrencyIndex(accounts) : null;

  const candidates: TransferCandidate[] = [];
  for (const transaction of transactions) {
    if (transaction.accountId !== targetAccountId) continue;
    if (transaction.id === source.id) continue;
    // A split parent cannot be a transfer, and an already-linked side is taken.
    if (transaction.isSplit) continue;
    if (transaction.linkedTransferId) continue;

    // The one branch. Everything else about a candidate is unchanged.
    const match = index
      ? crossCurrencyCandidate(source, transaction, index, options.rateLookup)
      : null;
    if (index ? !match : !toDecimal(transaction.amount).equals(oppositeAmount)) continue;

    const daysApart = Math.abs(new Date(transaction.date).getTime() - sourceTime) / DAY_MS;
    if (daysApart > windowDays) continue;

    candidates.push({
      transaction,
      daysApart,
      descriptionScore: calculateStringSimilarity(source.description, transaction.description),
      ...(match ? { crossCurrency: match.pair, rateDivergence: match.rateDivergence } : {}),
    });
  }

  // Closest date wins; description similarity breaks ties. A cross-currency
  // list uses the shared comparator, which inserts rate plausibility between
  // those two — and reduces to exactly this ordering when no quote was given.
  candidates.sort(
    crossed
      ? compareCrossCurrencyCandidates
      : (a, b) => a.daysApart - b.daysApart || b.descriptionScore - a.descriptionScore
  );
  return candidates;
}

/**
 * The account-managed "To/From <account>" category, if the account has one.
 *
 * Re-exported rather than defined here: the browser-storage write path needs
 * the same lookup, and importing this module from there would drag
 * duplicateScan's fuzzy matcher (used above, for description tie-breaking) into
 * the entry chunk, where nothing runs it. One definition, in transferRepoint.
 */
export { transferCategoryFor } from './transferRepoint';

/**
 * Would filing this transaction under `categoryId` make it a transfer to the
 * account it is ALREADY in?
 *
 * A transfer moves money between two accounts; "Current Account → Current
 * Account" describes nothing, and the manual editor already refuses it
 * ("That's this account's own transfer category — pick the OTHER account's
 * To/From category", QuickEditTransactionPanel). The importers' automatic
 * categoriser had no such guard, and its merchant key is the generic payment
 * channel — "immediate faster payment", "direct debit" — which a swept account's
 * own internal sweeps share with every third-party payment on the statement. So
 * ordinary direct debits arrived filed as transfers to the very account they sat
 * in. Suggestions are advice; this one is never right, whatever its confidence.
 */
export function isSelfTransferCategory(
  categories: readonly Category[],
  categoryId: string,
  accountId: string
): boolean {
  if (!categoryId || !accountId) return false;
  return categories.some(
    c => c.id === categoryId && c.isTransferCategory === true && c.accountId === accountId
  );
}
