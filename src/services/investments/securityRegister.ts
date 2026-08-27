/**
 * A security's full trading register, DERIVED — never stored.
 *
 * The multi-event sibling of buildHoldingRegister: where that one assumes a
 * constant quantity since purchase (stated in its header), this one folds
 * BUYS, SELLS and WRITE-OFFS through time and interleaves the price series
 * between them — the Microsoft Money register shape for a position that was
 * traded, which is what the imported history is.
 *
 * COST MOVES BY AVERAGE-COST POOLING (the UK's s.104 shape, and the only
 * basis derivable from events alone): every buy adds its full amount — fees
 * included — to one pool; a sell removes the pool's average cost per unit
 * for the units sold, and what it realises is proceeds minus that. A
 * write-off realises the removed units' pooled cost as a loss, receiving
 * nothing. Money kept per-lot records (its LOT table); the pool is the
 * declared simplification, stated here rather than hidden.
 *
 * RUNNING VALUE follows the holding-register ruling: a buy lands at COST
 * (pool cost, fees in), and the next priced line snaps to quantity × price,
 * absorbing the fees — "value now versus what it cost you" is the question
 * a register answers. Trades carry their own prices, so the running value
 * re-anchors at every event; revaluations between events move it with the
 * market.
 *
 * WHAT IS COUNTED, NEVER HIDDEN:
 *   - prices dated before the first trade (the position did not exist);
 *   - prices from stretches where the fold holds zero units (nothing to
 *     revalue — the owner's file really has these: sold out in January,
 *     back in by July);
 *   - a sell of more units than the pool holds (clamped to what is held,
 *     and counted — the import folds cleanly, so this surviving nonzero
 *     means somebody's data does not).
 */

import { toDecimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../utils/decimal';
import type { InvestmentEvent } from './events';
import type { HoldingPricePoint } from './holdingRegister';

export interface SecurityRegisterLine {
  kind: 'buy' | 'sell' | 'write_off' | 'revaluation';
  /** YYYY-MM-DD. */
  date: string;
  /** Per unit. Trades carry their own; a write-off and an unpriced buy have none. */
  price: DecimalInstance | null;
  /** Units held after this line. */
  quantityAfter: DecimalInstance;
  /**
   * The line's own money: a buy's total cost (positive), a sell's proceeds
   * (negative — money left the position), a revaluation's movement, zero
   * for a write-off. Money's own amount column, not a running sum.
   */
  amount: DecimalInstance;
  /** Sells and write-offs only: proceeds minus the pooled cost of the units. */
  realised: DecimalInstance | null;
  /** The position's value after this line — quantity × price where one is known. */
  runningValue: DecimalInstance;
  source: HoldingPricePoint['source'] | 'event';
}

export interface SecurityRegister {
  lines: SecurityRegisterLine[];
  /** Units still held after every event. Zero for a closed position. */
  endQuantity: DecimalInstance;
  /** The last line's running value; zero when nothing is held. */
  endValue: DecimalInstance;
  /** Σ buy amounts — everything ever paid in, fees included. */
  invested: DecimalInstance;
  /** Σ sell proceeds — everything ever taken out. */
  proceeds: DecimalInstance;
  /** Σ per-sale realised gain and write-off loss, on the pooled basis. */
  realisedGain: DecimalInstance;
  skipped: {
    pricesBeforeFirstTrade: number;
    pricesWhileNothingHeld: number;
    /** Sells clamped because they exceeded the pool. Nonzero = broken data. */
    soldMoreThanHeld: number;
  };
}

const ZERO = toDecimal('0');

export function buildSecurityRegister(
  events: readonly InvestmentEvent[],
  /** The symbol's price series, any order; empty for a symbol-less security. */
  series: readonly HoldingPricePoint[]
): SecurityRegister {
  const orderedEvents = events.slice().sort((a, b) => a.date.localeCompare(b.date));
  const orderedPrices = series.slice().sort((a, b) => a.date.localeCompare(b.date));

  const lines: SecurityRegisterLine[] = [];
  const skipped = { pricesBeforeFirstTrade: 0, pricesWhileNothingHeld: 0, soldMoreThanHeld: 0 };

  let poolQty = ZERO;
  let poolCost = ZERO;
  let lastPrice: DecimalInstance | null = null;
  let running = ZERO;
  let invested = ZERO;
  let proceeds = ZERO;
  let realisedGain = ZERO;

  const firstTradeDate = orderedEvents[0]?.date ?? null;

  /** quantity × last known price; the pool's cost when no price exists yet. */
  const valueNow = (): DecimalInstance => {
    if (poolQty.isZero()) return ZERO;
    return lastPrice === null ? poolCost : poolQty.times(lastPrice);
  };

  let priceIndex = 0;
  const consumePricesBefore = (date: string | null): void => {
    while (priceIndex < orderedPrices.length && (date === null || orderedPrices[priceIndex].date < date)) {
      const point = orderedPrices[priceIndex];
      priceIndex += 1;
      if (firstTradeDate === null || point.date < firstTradeDate) {
        skipped.pricesBeforeFirstTrade += 1;
        continue;
      }
      if (poolQty.isZero()) {
        skipped.pricesWhileNothingHeld += 1;
        continue;
      }
      const price = toDecimal(point.price);
      const valueAt = poolQty.times(price);
      const movement = valueAt.minus(running);
      lastPrice = price;
      if (movement.isZero()) continue; // a zero line is noise, not information
      lines.push({
        kind: 'revaluation',
        date: point.date,
        price,
        quantityAfter: poolQty,
        amount: movement,
        realised: null,
        runningValue: valueAt,
        source: point.source
      });
      running = valueAt;
    }
  };

  for (const event of orderedEvents) {
    // Prices strictly before the event's day revalue first; the event's own
    // day belongs to the event (a same-day quote then re-anchors after it).
    consumePricesBefore(event.date);

    const quantity = toDecimal(event.quantity);
    const amount = toDecimal(event.amount);
    const price = event.price === null ? null : toDecimal(event.price);
    if (price !== null) lastPrice = price;

    if (event.kind === 'buy') {
      poolQty = poolQty.plus(quantity);
      poolCost = poolCost.plus(amount);
      invested = invested.plus(amount);
      // At cost until the market says otherwise — the fees-absorption ruling.
      running = running.plus(amount);
      lines.push({
        kind: 'buy',
        date: event.date,
        price,
        quantityAfter: poolQty,
        amount,
        realised: null,
        runningValue: running,
        source: 'event'
      });
      continue;
    }

    // sell or write_off: units leave the pool at its average cost.
    let leaving = quantity;
    if (leaving.greaterThan(poolQty)) {
      skipped.soldMoreThanHeld += 1;
      leaving = poolQty;
    }
    const costOut = poolQty.isZero() ? ZERO : poolCost.times(leaving).dividedBy(poolQty);
    poolQty = poolQty.minus(leaving);
    poolCost = poolCost.minus(costOut);

    const received = event.kind === 'sell' ? amount : ZERO;
    if (event.kind === 'sell') proceeds = proceeds.plus(received);
    const realised = received.minus(costOut);
    realisedGain = realisedGain.plus(realised);

    running = valueNow();
    lines.push({
      kind: event.kind,
      date: event.date,
      price: event.kind === 'write_off' ? null : price,
      quantityAfter: poolQty,
      amount: event.kind === 'sell' ? received.negated() : ZERO,
      realised,
      runningValue: running,
      source: 'event'
    });
  }

  // Prices after the last event still revalue whatever is left held.
  consumePricesBefore(null);

  return {
    lines,
    endQuantity: poolQty,
    endValue: running,
    invested,
    proceeds,
    realisedGain,
    skipped
  };
}
