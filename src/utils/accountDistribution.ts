import { toDecimal, type DecimalInstance } from './decimal';
import { compareText } from './localeFormat';

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
   * This entry's contribution to NET WORTH, as a percentage — negative for a
   * liability, because owing money is a negative contribution and pretending
   * otherwise is how the ring stopped adding up. null when net worth is not
   * positive: a share of nothing (or of a debt) is not a percentage anyone
   * can read.
   */
  share: DecimalInstance | null;
}

export interface AccountDistribution {
  /** Every account, ranked by balance, largest first — nothing dropped. */
  entries: AccountDistributionEntry[];
  /**
   * The LEGEND: the largest accounts in credit, and — when more than one
   * other account exists — ONE remainder netting everything else, negatives
   * included, so the legend's figures SUM TO NET WORTH. Exactly one account
   * left over is shown by its own name instead: a fold of one hides nothing
   * and loses the name. The remainder is always LAST.
   */
  slices: AccountDistributionEntry[];
  /**
   * The RING: the slices a pie can draw — the positive ones, in the same
   * order. A pie has no negative wedge, so a below-zero remainder (or a
   * singly-named liability) lives in the legend alone, parenthesised. One
   * derivation here, not a filter at each call site, so the ring and the
   * legend can never disagree about what was dropped — and because anything
   * dropped is LAST, every drawn slice keeps the colour index its legend row
   * has.
   */
  wedges: AccountDistributionEntry[];
  /** What every share is a share OF now: everything owned less everything owed. */
  netWorth: DecimalInstance;
  /** Kept for surfaces that speak about money held: the sum of positive balances. */
  inCreditTotal: DecimalInstance;
  /**
   * How many accounts the remainder gathers — every account not named, of
   * either sign. Zero when every account is drawn by name.
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
    .sort((a, b) => (b.value - a.value) || compareText(a.name, b.name));

  const netWorth = balances.reduce(
    (sum, entry) => sum.plus(toDecimal(entry.value)),
    toDecimal(0)
  );
  const inCreditTotal = balances.reduce(
    (sum, entry) => (entry.value > 0 ? sum.plus(toDecimal(entry.value)) : sum),
    toDecimal(0)
  );

  // Decimal, not float: a share is derived from money, and the percentages are
  // read against each other. The denominator is NET WORTH — see the ruling on
  // the slices below — and a liability's contribution is honestly negative.
  const shareOf = (value: number): DecimalInstance | null =>
    netWorth.greaterThan(0) && value !== 0
      ? toDecimal(value).dividedBy(netWorth).times(100)
      : null;

  const entries: AccountDistributionEntry[] = balances.map(entry => ({
    ...entry,
    share: shareOf(entry.value),
  }));

  /**
   * THE LEGEND SUMS TO NET WORTH (owner, 17 Aug). The first fold gathered
   * only the accounts IN CREDIT, and on a real ledger that legend totalled
   * far MORE than net worth — gross investment values and loans-out counted,
   * every liability ignored — which the owner read exactly right: "otherwise
   * it looks like a useless report". So the remainder now gathers EVERY
   * account not named, negatives included, and the whole is net worth:
   *
   *     top accounts in credit  +  everything else, net  =  net worth
   *
   * The remainder is a Decimal subtraction from net worth, not a float sum
   * of ninety balances, so the reconciliation holds to the penny by
   * construction. It is NAMED WITH ITS COUNT ("51 other accounts") rather
   * than "Other" — "Other" is a real category in some ledgers, and a count
   * tells the reader how much the fold gathered.
   *
   * A pie cannot draw a negative wedge, so when the net remainder is below
   * zero the LEGEND still shows it — in the accounting parentheses — and the
   * ring draws the named slices alone. The remainder being LAST is what
   * makes that safe: dropping the last element leaves every named slice's
   * colour index untouched, so a filtered ring and a full legend cannot
   * disagree about which colour is whose.
   */
  const named = entries
    .filter(entry => entry.value > 0)
    .slice(0, ACCOUNT_DISTRIBUTION_SLICES - 1);
  const namedIds = new Set(named.map(entry => entry.id));
  const rest = entries.filter(entry => !namedIds.has(entry.id));

  let slices: AccountDistributionEntry[];
  let foldedCount = 0;
  if (rest.length === 0) {
    slices = named;
  } else if (rest.length === 1) {
    // A fold of one hides nothing and loses the name — the last account is
    // its own row, sign and all. The reconciliation still holds: the five
    // rows are simply every account.
    slices = [...named, rest[0]];
  } else {
    foldedCount = rest.length;
    const namedTotal = named.reduce((sum, entry) => sum.plus(toDecimal(entry.value)), toDecimal(0));
    const remainder = netWorth.minus(namedTotal);
    slices = [
      ...named,
      {
        id: ACCOUNT_DISTRIBUTION_REMAINDER_ID,
        name: `${foldedCount} other accounts`,
        value: remainder.toNumber(),
        share: shareOf(remainder.toNumber()),
      },
    ];
  }

  const wedges = slices.filter(entry => entry.value > 0);

  return { entries, slices, wedges, netWorth, inCreditTotal, foldedCount };
}
