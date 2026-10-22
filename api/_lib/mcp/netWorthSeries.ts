/**
 * Net worth over time for the connector — the app's series, walked backwards.
 *
 * ── WHY BACKWARDS ───────────────────────────────────────────────────────────
 * The app's `buildNetWorthSnapshots` walks forward from zero through every
 * transaction the ledger has ever held, because the browser already holds
 * them all. A serverless function does not, and must not read fifty thousand
 * rows through a thousand-row-per-page transport to answer "what was I worth
 * at the end of March". So this walk starts from what the register's balance
 * function already knows — each account's balance TODAY, opening balance
 * plus every row — and takes rows away as it steps back through the points:
 *
 *   balance(account, point) = balance(account, today)
 *                           − Σ amount of the account's rows dated after the point
 *                           − its opening balance, if its opening date is after the point
 *
 * That is the forward walk's figure exactly, rearranged, which the spec
 * proves by running both over one ledger. Only the rows dated after the
 * window's first day are needed: a few thousand for a year, however long the
 * history behind them.
 *
 * ── WHAT IS SHARED, NOT RESTATED ────────────────────────────────────────────
 * The points come from `utils/netWorthCadence` and the opening-balance dates
 * from `utils/openingDates` — the same two rules the report and the Dashboard
 * card use — so a figure Claude quotes for a day is the figure the report
 * shows for that day. Each account's first activity (the earliest row it has,
 * which the opening-date rule needs) comes from the database as one minimum
 * per account rather than from the rows themselves.
 *
 * ── PER CURRENCY, NO CONVERSION ─────────────────────────────────────────────
 * The report converts every account into the display currency at each day's
 * rates. This server holds no rate table, so like `reckley_net_worth` it
 * reports one series per currency and says so. For a ledger in one currency
 * the two are the same line.
 */

import { toDecimal, type DecimalInstance } from '../../../src/utils/decimal.js';
import { endOfPoint, netWorthPoints } from '../../../src/utils/netWorthCadence.js';
import { resolveEffectiveOpeningDatesFromFirstActivity, type OpeningDateAccount } from '../../../src/utils/openingDates.js';

export interface SeriesAccount extends OpeningDateAccount {
  currency: string;
  openingBalance: number;
  /** Opening balance plus every row, as the register computes it today. */
  balance: number;
}

export interface SeriesRow {
  accountId: string;
  date: Date;
  amount: number;
}

export interface SeriesPoint {
  date: Date;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface CurrencySeries {
  currency: string;
  /** Accounts summed into this line. */
  accounts: number;
  points: SeriesPoint[];
}

export interface NetWorthSeriesInput {
  accounts: readonly SeriesAccount[];
  /**
   * Each account's earliest transaction, as epoch milliseconds, for the
   * opening-date rule; null when the database cannot say, in which case an
   * explicit opening date still holds and every other account's opening
   * balance is treated as present throughout.
   */
  firstActivity: ReadonlyMap<string, number> | null;
  /** Every row dated AFTER `from`, archived rows included, whatever the account's state. */
  rows: readonly SeriesRow[];
  from: Date;
  to: Date;
}

export interface NetWorthSeriesResult {
  series: CurrencySeries[];
  /** True when the points are month-ends rather than every day. */
  monthly: boolean;
  /** Accounts whose non-zero opening balance has no date at all and so counts from the start (the report warns about these too). */
  undatedOpenings: number;
}

const byCodePoint = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

export interface BalanceWalkInput {
  accounts: readonly SeriesAccount[];
  firstActivity: ReadonlyMap<string, number> | null;
  /** Every row dated after the EARLIEST point asked for, archived rows included. */
  rows: readonly SeriesRow[];
}

export interface BalanceWalk {
  /** Each account's balance at the end of each point's day, in the order the points were given. */
  atPoints: Map<string, DecimalInstance>[];
  undatedOpenings: number;
}

/**
 * The walk itself: from today's balances back through the points, oldest
 * last. `netWorthSeriesByCurrency` sums what this gives; `reckley_list_accounts`
 * with `as_of` and `reckley_account_activity` read one day of it.
 */
export function walkBalances(input: BalanceWalkInput, points: readonly Date[]): BalanceWalk {
  const { accounts, rows } = input;
  const openingDates = resolveEffectiveOpeningDatesFromFirstActivity(accounts, input.firstActivity ?? new Map());

  // Today's balances, the walk's starting point.
  const balances = new Map<string, DecimalInstance>();
  let undatedOpenings = 0;
  const openingEvents: Array<{ accountId: string; time: number; amount: DecimalInstance }> = [];
  for (const account of accounts) {
    balances.set(account.id, toDecimal(account.balance));
    const opening = toDecimal(account.openingBalance ?? 0);
    const eff = openingDates.get(account.id);
    if (eff === undefined) {
      if (!opening.isZero()) undatedOpenings += 1;
    } else if (!opening.isZero()) {
      openingEvents.push({ accountId: account.id, time: eff.getTime(), amount: opening });
    }
  }
  // Latest first: the walk steps back through time.
  openingEvents.sort((x, y) => y.time - x.time);
  const sorted = rows
    .filter(row => balances.has(row.accountId))
    .map(row => ({ ...row, time: row.date.getTime() }))
    .sort((x, y) => y.time - x.time);

  const atPoints: Map<string, DecimalInstance>[] = new Array(points.length);
  let i = 0;
  let j = 0;
  for (let p = points.length - 1; p >= 0; p -= 1) {
    const cutoffTime = endOfPoint(points[p]).getTime();
    // Everything dated after this point has not happened yet: take it away.
    while (i < sorted.length && sorted[i].time > cutoffTime) {
      const row = sorted[i];
      balances.set(row.accountId, balances.get(row.accountId)!.minus(toDecimal(row.amount)));
      i += 1;
    }
    while (j < openingEvents.length && openingEvents[j].time > cutoffTime) {
      const event = openingEvents[j];
      balances.set(event.accountId, balances.get(event.accountId)!.minus(event.amount));
      j += 1;
    }
    atPoints[p] = new Map(balances);
  }
  return { atPoints, undatedOpenings };
}

/** Every account's balance at the end of one day. */
export function balancesAt(input: BalanceWalkInput, day: Date): BalanceWalk & { balances: Map<string, DecimalInstance> } {
  const walk = walkBalances(input, [day]);
  return { ...walk, balances: walk.atPoints[0] ?? new Map() };
}

export function netWorthSeriesByCurrency(input: NetWorthSeriesInput): NetWorthSeriesResult {
  const { accounts, from, to } = input;
  const { points, monthly } = netWorthPoints(from, to);
  if (accounts.length === 0 || points.length === 0) return { series: [], monthly, undatedOpenings: 0 };

  const walk = walkBalances(input, points);
  const currencyOf = new Map(accounts.map(account => [account.id, account.currency]));
  const currencies = [...new Set(accounts.map(account => account.currency))].sort(byCodePoint);
  const perCurrency = new Map<string, SeriesPoint[]>(currencies.map(currency => [currency, []]));

  points.forEach((point, p) => {
    const sides = new Map<string, { assets: DecimalInstance; liabilities: DecimalInstance }>();
    for (const [accountId, balance] of walk.atPoints[p]) {
      const currency = currencyOf.get(accountId)!;
      const side = sides.get(currency) ?? { assets: toDecimal(0), liabilities: toDecimal(0) };
      if (balance.greaterThan(0)) side.assets = side.assets.plus(balance);
      else side.liabilities = side.liabilities.plus(balance.abs());
      sides.set(currency, side);
    }
    for (const currency of currencies) {
      const side = sides.get(currency) ?? { assets: toDecimal(0), liabilities: toDecimal(0) };
      perCurrency.get(currency)!.push({
        date: point,
        assets: side.assets.toNumber(),
        liabilities: side.liabilities.toNumber(),
        netWorth: side.assets.minus(side.liabilities).toNumber(),
      });
    }
  });

  const counts = new Map<string, number>();
  for (const account of accounts) counts.set(account.currency, (counts.get(account.currency) ?? 0) + 1);
  return {
    series: currencies.map(currency => ({
      currency,
      accounts: counts.get(currency) ?? 0,
      points: perCurrency.get(currency)!,
    })),
    monthly,
    undatedOpenings: walk.undatedOpenings,
  };
}
