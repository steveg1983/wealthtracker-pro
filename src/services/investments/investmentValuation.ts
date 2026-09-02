/**
 * What every investment position adds to net worth on a date, DERIVED.
 *
 * THE MODEL (slice 3b's design, 27 Aug): every value surface in the app is
 * ledger-basis — an investment account's balance is opening + transactions,
 * which carries buys at COST. Between trade dates the market moved and no
 * chart ever saw it (measured on the owner's ledger: ~£96,900 of pooled cost
 * carried through 2012–13 while the market said £68,800). The fix is the
 * register's own construction, summed:
 *
 *     value(account, D) = ledger(D) + Σ per security
 *                         [ units(D) × last-price-on-or-before(D) − pooled-cost(D) ]
 *
 * The added term is exactly the derived revaluations that are NOT in the
 * ledger. While a position is open with a price, the account values at
 * market by construction; when everything is sold the term is zero and the
 * ledger stands alone. This module computes that term — the DELTA — as a
 * per-account step function over time, for the walks that snapshot history
 * and for the surfaces that state today.
 *
 * WHAT FEEDS IT: imported/manual events (quantity and pooled cost over time,
 * the same s.104 fold as buildSecurityRegister), current holdings rows for
 * positions with no events (constant quantity since purchase, pooled cost =
 * cost basis — the pre-slice-4 shape, stated in buildHoldingRegister too),
 * and the price table. A holding whose (account, symbol) also has events is
 * skipped in favour of the events — they are the richer truth, and counting
 * both would double the position.
 *
 * WHAT IS COUNTED, NEVER GUESSED:
 *   - a position with no usable price counts at cost — delta zero, and the
 *     position is counted in `unpricedPositions` so a basis line can say so;
 *   - a price series in a different currency than its account is NOT mixed
 *     into the account's arithmetic — the position counts at cost and the
 *     mismatch is counted (`currencyMismatches`), the unconverted pattern.
 *
 * Deltas are in the ACCOUNT's own currency, exactly like ledger balances —
 * the net-worth walks convert native figures at the summing, and a delta
 * must ride the same conversion.
 */

import { toDecimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../utils/decimal';
import type { InvestmentEvent } from './events';
import type { InvestmentHolding } from './holding';
import { compareText } from '../../utils/localeFormat';

/** A dated price with its symbol and currency — the user-wide price read. */
export interface SymbolPricePoint {
  symbol: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Decimal string, the SECURITY's currency. */
  price: string;
  currency: string;
}

export interface InvestmentValuation {
  /**
   * The derived delta for one account as at the END of `day` (YYYY-MM-DD):
   * market value of its open positions minus their pooled cost. Zero for an
   * account with no positions, before its first trade, and after everything
   * is sold.
   */
  deltaAt(accountId: string, day: string): DecimalInstance;
  /** Accounts that carry any derived value anywhere in time. */
  accountIds: ReadonlySet<string>;
  /** Positions that never had a usable price — counted at cost throughout. */
  unpricedPositions: number;
  /** Positions whose price currency differs from the account's — at cost. */
  currencyMismatches: number;
}

const ZERO = toDecimal('0');

interface Step {
  day: string;
  delta: DecimalInstance;
}

/** Last step on or before `day`, by binary search; ZERO before the first. */
const stepAt = (steps: readonly Step[], day: string): DecimalInstance => {
  let low = 0;
  let high = steps.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (steps[mid].day <= day) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found === -1 ? ZERO : steps[found].delta;
};

interface Position {
  accountId: string;
  accountCurrency: string;
  symbol: string | null;
  /** Chronological quantity/cost changes: buys add, sells/write-offs remove. */
  moves: Array<{
    day: string;
    kind: 'buy' | 'sell' | 'write_off';
    quantity: DecimalInstance;
    amount: DecimalInstance;
    /** The trade's own per-unit price — a value anchor, like the registers'. */
    price: DecimalInstance | null;
  }>;
}

export function buildInvestmentValuation(
  events: readonly InvestmentEvent[],
  holdings: readonly InvestmentHolding[],
  prices: readonly SymbolPricePoint[]
): InvestmentValuation {
  // ── positions from events, keyed (account, security) ──────────────────────
  const positions = new Map<string, Position>();
  const eventKeys = new Set<string>();
  for (const event of events) {
    const security = event.symbol ?? `name:${event.securityName}`;
    const key = `${event.accountId}|${security}`;
    eventKeys.add(key);
    const position =
      positions.get(key) ??
      positions
        .set(key, {
          accountId: event.accountId,
          accountCurrency: event.currency,
          symbol: event.symbol,
          moves: []
        })
        .get(key)!;
    position.moves.push({
      day: event.date,
      kind: event.kind,
      quantity: toDecimal(event.quantity),
      amount: toDecimal(event.amount),
      price: event.price === null ? null : toDecimal(event.price)
    });
  }

  // ── positions from event-less holdings: constant since purchase ───────────
  for (const holding of holdings) {
    if (holding.accountId === null) continue; // rows this app writes always name one
    const key = `${holding.accountId}|${holding.symbol}`;
    if (eventKeys.has(key)) continue; // events are the richer truth — never both
    const day = holding.purchaseDate
      ? holding.purchaseDate.toISOString().slice(0, 10)
      : '0000-00-00'; // undated: present from the beginning, as the register assumes
    positions.set(key, {
      accountId: holding.accountId,
      accountCurrency: holding.currency,
      symbol: holding.symbol,
      // No price anchor from the holding row itself: costBasis already tells
      // the at-cost story, and the register's snapshot price arrives through
      // the price table like any other.
      moves: [{ day, kind: 'buy', quantity: holding.quantity, amount: holding.costBasis, price: null }]
    });
  }

  // ── price series per symbol, first-in order preserved then sorted ─────────
  const pricesBySymbol = new Map<string, SymbolPricePoint[]>();
  for (const point of prices) {
    (pricesBySymbol.get(point.symbol) ?? pricesBySymbol.set(point.symbol, []).get(point.symbol)!).push(point);
  }
  for (const series of pricesBySymbol.values()) {
    series.sort((a, b) => compareText(a.date, b.date));
  }

  // ── each position folds into a delta step function; accounts sum theirs ───
  const stepsByAccount = new Map<string, Step[]>();
  const accountIds = new Set<string>();
  let unpricedPositions = 0;
  let currencyMismatches = 0;

  for (const position of positions.values()) {
    position.moves.sort((a, b) => compareText(a.day, b.day));

    let series = position.symbol === null ? [] : pricesBySymbol.get(position.symbol) ?? [];
    if (series.length > 0 && series.some((p) => p.currency !== position.accountCurrency)) {
      // Mixed currencies are not arithmetic — the position stays at cost.
      currencyMismatches += 1;
      series = [];
    } else if (series.length === 0) {
      unpricedPositions += 1;
    }

    // Merge move-days and price-days chronologically; a same-day price lands
    // AFTER the trade, exactly as the registers order them.
    let poolQty = ZERO;
    let poolCost = ZERO;
    let lastPrice: DecimalInstance | null = null;
    const steps: Step[] = [];
    let m = 0;
    let p = 0;
    const push = (day: string): void => {
      const delta = poolQty.isZero() || lastPrice === null
        ? ZERO
        : poolQty.times(lastPrice).minus(poolCost);
      // Consecutive same-day entries collapse to the day's final word.
      if (steps.length > 0 && steps[steps.length - 1].day === day) {
        steps[steps.length - 1].delta = delta;
      } else {
        steps.push({ day, delta });
      }
    };
    while (m < position.moves.length || p < series.length) {
      const moveDay = m < position.moves.length ? position.moves[m].day : null;
      const priceDay = p < series.length ? series[p].date : null;
      if (moveDay !== null && (priceDay === null || moveDay <= priceDay)) {
        const move = position.moves[m];
        m += 1;
        // The trade's own price re-anchors the value, exactly as the
        // registers do (buildSecurityRegister keeps lastPrice from every
        // event) — so a buy's fees appear immediately as the small negative
        // delta the register's fees-absorption ruling prescribes, and the
        // remainder after a partial sell values at the sale's own price.
        if (move.price !== null) lastPrice = move.price;
        if (move.kind === 'buy') {
          poolQty = poolQty.plus(move.quantity);
          poolCost = poolCost.plus(move.amount);
        } else {
          const leaving = move.quantity.greaterThan(poolQty) ? poolQty : move.quantity;
          const costOut = poolQty.isZero() ? ZERO : poolCost.times(leaving).dividedBy(poolQty);
          poolQty = poolQty.minus(leaving);
          poolCost = poolCost.minus(costOut);
          if (poolQty.isZero()) lastPrice = null; // a closed position values nothing
        }
        push(move.day);
      } else if (priceDay !== null) {
        const point = series[p];
        p += 1;
        // A price only matters while something is held; before the first
        // trade or during a sold-out stretch it moves nothing — and writes
        // no step, so the position's delta stays exactly zero there.
        if (poolQty.isZero()) continue;
        lastPrice = toDecimal(point.price);
        push(point.date);
      }
    }

    if (steps.length === 0) continue;
    accountIds.add(position.accountId);
    const merged = stepsByAccount.get(position.accountId);
    if (merged === undefined) {
      stepsByAccount.set(position.accountId, steps);
    } else {
      stepsByAccount.set(position.accountId, mergeSteps(merged, steps));
    }
  }

  return {
    deltaAt(accountId, day) {
      const steps = stepsByAccount.get(accountId);
      return steps === undefined ? ZERO : stepAt(steps, day);
    },
    accountIds,
    unpricedPositions,
    currencyMismatches
  };
}

/** Sum two per-position step functions into one per-account step function. */
function mergeSteps(a: readonly Step[], b: readonly Step[]): Step[] {
  const out: Step[] = [];
  let i = 0;
  let j = 0;
  let lastA = ZERO;
  let lastB = ZERO;
  while (i < a.length || j < b.length) {
    const dayA = i < a.length ? a[i].day : null;
    const dayB = j < b.length ? b[j].day : null;
    let day: string;
    if (dayA !== null && (dayB === null || dayA <= dayB)) {
      day = dayA;
      lastA = a[i].delta;
      i += 1;
      // A shared day advances both, once.
      if (dayB === day) {
        lastB = b[j].delta;
        j += 1;
      }
    } else {
      day = dayB!;
      lastB = b[j].delta;
      j += 1;
    }
    const total = lastA.plus(lastB);
    if (out.length > 0 && out[out.length - 1].day === day) {
      out[out.length - 1].delta = total;
    } else {
      out.push({ day, delta: total });
    }
  }
  return out;
}
