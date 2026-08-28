/**
 * What was held, and what it was worth, AS AT a date.
 *
 * The report's fold (the owner's ask, 28 Aug: "a report of all investment
 * holdings… change the date (as at)… drill in to any holding to see the
 * register"). Same three sources and the same rulings as the net-worth
 * valuation, arranged per POSITION rather than per account:
 *
 *   * EVENTS give quantity over time — buys add, sells and write-offs
 *     remove, folded to the as-at day and never past it. Cost follows the
 *     s.104 average-cost pool, exactly as buildSecurityRegister does, so a
 *     position's cost here and its register's cost cannot disagree.
 *   * HOLDINGS with no events count constant since purchase (the pre-event
 *     shape, stated rather than hidden), and are skipped entirely when
 *     their (account, symbol) has events — the events are the richer truth
 *     and counting both would double the position.
 *   * PRICES value it: the last price on or before the as-at day, in the
 *     SECURITY's currency. A position whose price series is in another
 *     currency than its own money is NOT valued from it — at cost, and
 *     counted, the same refusal the valuation module and the registers make.
 *
 * A CLOSED POSITION IS ABSENT, not zero: a report of what you hold on a day
 * lists what you held. What was traded and closed lives in the register,
 * which is one click away.
 */

import { toDecimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../utils/decimal';
import type { InvestmentEvent } from './events';
import type { InvestmentHolding } from './holding';
import type { SymbolPricePoint } from './investmentValuation';

export interface HeldPosition {
  /** Stable key for a row: account + security. */
  key: string;
  accountId: string;
  symbol: string | null;
  securityName: string;
  /** The account's money — what cost and value are stated in. */
  currency: string;
  quantity: DecimalInstance;
  /** Pooled cost of the units still held. */
  cost: DecimalInstance;
  /** quantity × price-on-or-before, or null when nothing valued it. */
  value: DecimalInstance | null;
  /** The price used, and the day it was quoted — the report says both. */
  price: DecimalInstance | null;
  priceDate: string | null;
  /** value − cost, or null when unvalued. */
  gain: DecimalInstance | null;
  /** Where the position's shape came from — the report can say so. */
  source: 'events' | 'holding';
}

export interface HoldingsAsAt {
  positions: HeldPosition[];
  /** Positions counted at cost because nothing priced them. */
  unpriced: number;
  /** Positions whose price series is in another currency — at cost. */
  currencyMismatches: number;
}

const ZERO = toDecimal('0');

/** The last price on or before `day`, ignoring any in another currency. */
const priceAsAt = (
  series: readonly SymbolPricePoint[],
  day: string,
  currency: string
): { price: DecimalInstance; date: string } | { mismatch: true } | null => {
  let best: SymbolPricePoint | null = null;
  let sawMismatch = false;
  for (const point of series) {
    if (point.date > day) continue;
    if (point.currency !== currency) {
      sawMismatch = true;
      continue;
    }
    if (best === null || point.date > best.date) best = point;
  }
  if (best !== null) return { price: toDecimal(best.price), date: best.date };
  return sawMismatch ? { mismatch: true } : null;
};

export function buildHoldingsAsAt(
  events: readonly InvestmentEvent[],
  holdings: readonly InvestmentHolding[],
  prices: readonly SymbolPricePoint[],
  /** YYYY-MM-DD. */
  asAt: string
): HoldingsAsAt {
  const pricesBySymbol = new Map<string, SymbolPricePoint[]>();
  for (const point of prices) {
    (pricesBySymbol.get(point.symbol) ?? pricesBySymbol.set(point.symbol, []).get(point.symbol)!).push(point);
  }

  interface Fold {
    accountId: string;
    symbol: string | null;
    securityName: string;
    currency: string;
    quantity: DecimalInstance;
    cost: DecimalInstance;
    source: 'events' | 'holding';
  }
  const folds = new Map<string, Fold>();
  const eventKeys = new Set<string>();

  const ordered = events
    .filter((event) => event.date <= asAt)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const event of ordered) {
    const security = event.symbol ?? `name:${event.securityName}`;
    const key = `${event.accountId}|${security}`;
    eventKeys.add(key);
    const fold =
      folds.get(key) ??
      folds
        .set(key, {
          accountId: event.accountId,
          symbol: event.symbol,
          securityName: event.securityName,
          currency: event.currency,
          quantity: ZERO,
          cost: ZERO,
          source: 'events'
        })
        .get(key)!;
    const quantity = toDecimal(event.quantity);
    if (event.kind === 'buy') {
      fold.quantity = fold.quantity.plus(quantity);
      fold.cost = fold.cost.plus(toDecimal(event.amount));
    } else {
      const leaving = quantity.greaterThan(fold.quantity) ? fold.quantity : quantity;
      const costOut = fold.quantity.isZero()
        ? ZERO
        : fold.cost.times(leaving).dividedBy(fold.quantity);
      fold.quantity = fold.quantity.minus(leaving);
      fold.cost = fold.cost.minus(costOut);
    }
  }

  // Event-less holdings: constant since purchase, absent before it.
  for (const holding of holdings) {
    if (holding.accountId === null) continue;
    const key = `${holding.accountId}|${holding.symbol}`;
    if (eventKeys.has(key)) continue;
    const purchased = holding.purchaseDate
      ? holding.purchaseDate.toISOString().slice(0, 10)
      : null;
    if (purchased !== null && purchased > asAt) continue;
    folds.set(key, {
      accountId: holding.accountId,
      symbol: holding.symbol,
      securityName: holding.name,
      currency: holding.currency,
      quantity: holding.quantity,
      cost: holding.costBasis,
      source: 'holding'
    });
  }

  const positions: HeldPosition[] = [];
  let unpriced = 0;
  let currencyMismatches = 0;

  for (const [key, fold] of folds) {
    if (fold.quantity.isZero() || fold.quantity.isNegative()) continue; // closed: absent, not zero
    const series = fold.symbol === null ? [] : pricesBySymbol.get(fold.symbol) ?? [];
    const found = priceAsAt(series, asAt, fold.currency);

    let price: DecimalInstance | null = null;
    let priceDate: string | null = null;
    if (found !== null && 'price' in found) {
      price = found.price;
      priceDate = found.date;
    } else if (found !== null) {
      currencyMismatches += 1;
    } else {
      unpriced += 1;
    }

    const value = price === null ? null : fold.quantity.times(price);
    positions.push({
      key,
      accountId: fold.accountId,
      symbol: fold.symbol,
      securityName: fold.securityName,
      currency: fold.currency,
      quantity: fold.quantity,
      cost: fold.cost,
      value,
      price,
      priceDate,
      gain: value === null ? null : value.minus(fold.cost),
      source: fold.source
    });
  }

  positions.sort((a, b) => a.securityName.localeCompare(b.securityName));
  return { positions, unpriced, currencyMismatches };
}
