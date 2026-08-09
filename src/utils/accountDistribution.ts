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
   * The slices a donut can draw: the largest accounts in credit. A pie cannot
   * show a negative, and past a handful of slices nobody can tell them apart,
   * so the chart is a summary and the table beside it is the truth.
   */
  slices: AccountDistributionEntry[];
  /** What every share is a share OF: the total held in credit. */
  inCreditTotal: DecimalInstance;
}

/**
 * How many slices the donut draws, in BOTH views. One constant, because a card
 * showing five and a report showing eight is two different pictures of one set
 * of numbers.
 */
export const ACCOUNT_DISTRIBUTION_SLICES = 5;

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

  return {
    entries,
    slices: entries.filter(entry => entry.value > 0).slice(0, ACCOUNT_DISTRIBUTION_SLICES),
    inCreditTotal,
  };
}
