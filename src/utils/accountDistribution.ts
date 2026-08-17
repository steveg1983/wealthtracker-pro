import { toDecimal, type DecimalInstance } from './decimal';

/**
 * Who holds the money, right now.
 *
 * ONE implementation, shared by the Dashboard's "Account Distribution" card and
 * the full report behind it, so the glance and the page can never disagree
 * about a balance, a share or the order of the ranking. Both are handed the
 * SAME balance map — `computeAccountBalances(accounts, transactions,
 * serverBalances)` — and nothing here recomputes a balance of its own.
 *
 * This is a snapshot of TODAY and has no period: there is no "distribution last
 * March" to draw, because the balances are what the accounts hold now. Both
 * views say so on screen.
 */

/** The minimum an account must expose for its slice to be drawn. */
interface AccountLike {
  id: string;
  name: string;
}

export interface AccountDistributionEntry {
  id: string;
  name: string;
  /** Current balance: openingBalance + Σ transactions (see computeAccountBalances). */
  value: number;
  /**
   * Percentage of everything held in credit, or null when the account holds
   * nothing to take a share of. A share of a positive whole is only meaningful
   * for a positive part: an overdrawn account is not "-4% of the money", and a
   * zero balance is not 0% of anything it is part of.
   */
  share: DecimalInstance | null;
}

export interface AccountDistribution {
  /** Every account, ranked by balance, largest first — nothing dropped. */
  entries: AccountDistributionEntry[];
  /**
   * The slices the donut draws: the largest accounts in credit, and — when
   * there are more in credit than the ring can name — ONE slice holding
   * everything else, so the ring always sums to the whole. A pie cannot show
   * a negative, so overdrawn accounts appear in the table, never the ring.
   */
  slices: AccountDistributionEntry[];
  /** What every share is a share OF: the total held in credit. */
  inCreditTotal: DecimalInstance;
  /**
   * How many in-credit accounts the ring folded into its remainder slice —
   * zero when every one is drawn by name. Exposed so the copy above each ring
   * can say what was folded without parsing the slice's own label.
   */
  foldedCount: number;
}

/**
 * How many slices the donut draws, in BOTH views. One constant, because a card
 * showing five and a report showing eight is two different pictures of one set
 * of numbers.
 */
export const ACCOUNT_DISTRIBUTION_SLICES = 5;

/**
 * The id the folded remainder slice carries instead of an account id. A
 * sentinel no database id can collide with, so a click handler can tell "open
 * this account" from "open the full report" without a second data shape.
 */
export const ACCOUNT_DISTRIBUTION_REMAINDER_ID = '__account-distribution-remainder__';

/**
 * Rank every account by what it currently holds.
 *
 * `balanceOf` is the caller's balance map lookup, so the figures are whatever
 * that view already trusts — never a second sum computed here.
 *
 * Zero balances are kept: an account holding nothing is part of the answer to
 * "where is my money", and dropping it silently is how a user concludes the app
 * has lost an account. Closed accounts never reach this — they are not loaded.
 */
export function buildAccountDistribution(
  accounts: readonly AccountLike[],
  balanceOf: (accountId: string) => number
): AccountDistribution {
  const balances = accounts
    .map(account => ({ id: account.id, name: account.name, value: balanceOf(account.id) }))
    // Largest first, then by name so two accounts holding the same amount keep
    // a stable order between renders instead of swapping places.
    .sort((a, b) => (b.value - a.value) || a.name.localeCompare(b.name));

  const inCreditTotal = balances.reduce(
    (sum, entry) => (entry.value > 0 ? sum.plus(toDecimal(entry.value)) : sum),
    toDecimal(0)
  );

  // Decimal, not float: a share is derived from money, and the percentages are
  // read against each other.
  const entries: AccountDistributionEntry[] = balances.map(entry => ({
    ...entry,
    share: entry.value > 0 && inCreditTotal.greaterThan(0)
      ? toDecimal(entry.value).dividedBy(inCreditTotal).times(100)
      : null,
  }));

  /**
   * A CLOSED RING IS A CLAIM ABOUT THE WHOLE (Claude Design, 17 Aug §2.1).
   * Drawn from the top five alone it showed ~55% of the money as if it were
   * 100%, so a reader concluded their largest account was a sixth of their
   * net worth when it was a thirty-fifth. Everything past the named slices is
   * folded into ONE remainder slice — same arithmetic as
   * capSeriesWithRemainder, done here so the card and the report cannot fold
   * differently. The remainder is NAMED WITH ITS COUNT rather than "Other":
   * "Other" is a real category in some ledgers, and a visible count tells the
   * reader whether the fold hid something worth opening the full report for.
   *
   * The value comes from inCreditTotal minus the named slices — a Decimal
   * subtraction, not a float sum of ninety balances — so ring and total agree
   * to the penny by construction.
   */
  const inCredit = entries.filter(entry => entry.value > 0);
  let slices: AccountDistributionEntry[];
  let foldedCount = 0;
  if (inCredit.length <= ACCOUNT_DISTRIBUTION_SLICES) {
    slices = inCredit;
  } else {
    const named = inCredit.slice(0, ACCOUNT_DISTRIBUTION_SLICES - 1);
    foldedCount = inCredit.length - named.length;
    const namedTotal = named.reduce((sum, entry) => sum.plus(toDecimal(entry.value)), toDecimal(0));
    const remainder = inCreditTotal.minus(namedTotal);
    slices = [
      ...named,
      {
        id: ACCOUNT_DISTRIBUTION_REMAINDER_ID,
        name: `${foldedCount} smaller account${foldedCount === 1 ? '' : 's'}`,
        value: remainder.toNumber(),
        share: inCreditTotal.greaterThan(0) ? remainder.dividedBy(inCreditTotal).times(100) : null,
      },
    ];
  }

  return { entries, slices, inCreditTotal, foldedCount };
}
