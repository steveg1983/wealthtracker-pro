/**
 * A holding's register, DERIVED — never stored.
 *
 * The owner's ruling (27 Aug): price history is the source of truth, and the
 * revaluation lines a holding's register shows are computed from consecutive
 * prices. Correcting a bad price therefore corrects the register in one row,
 * and the two can never drift apart — the accepted trade-off being that a
 * price correction silently rewrites derived history, which is right for a
 * price and unlike a bank feed.
 *
 * The shape is Microsoft Money's, deliberately (his measured precedent, and
 * his register mock-up): a Buy line for what was actually paid, then one
 * Revaluation line per later price, each amount being the movement since the
 * previous line, with the running value always equal to quantity × the
 * latest price — so the register's total IS the market value, by
 * construction, and the old "never sum market value with ledger value"
 * prohibition dissolves: a value built of dated lines is ledger-shaped.
 *
 * THE BUY LINE CARRIES THE COST BASIS, charges included, and the first
 * revaluation therefore absorbs the difference between what was paid (with
 * fees, at the dealt price) and what the market said next. That is honest:
 * "value now versus what it cost you" is the question a register answers,
 * and burying fees in a synthetic price would answer a different one.
 *
 * QUANTITY IS CONSTANT for now — stated, not hidden. Until buy/sell events
 * exist (slice 4), the register assumes the position has been its current
 * size since purchase. Prices dated before the purchase are ignored for the
 * same reason: the eight imported years of a security's prices are not
 * revaluations of a position that did not yet exist.
 */

import { toDecimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../utils/decimal';

export interface HoldingPricePoint {
  /** YYYY-MM-DD. */
  date: string;
  /** Decimal string, major unit, the SECURITY's currency. */
  price: string;
  source: 'quote' | 'manual' | 'trade' | 'import';
}

export interface RegisterLine {
  kind: 'buy' | 'revaluation';
  /** YYYY-MM-DD; the buy line uses the purchase date, or null if unrecorded. */
  date: string | null;
  /** The per-unit price this line was computed from. null on a buy with no recorded price. */
  price: DecimalInstance | null;
  /** Signed movement this line contributes. The buy line's is the cost basis. */
  amount: DecimalInstance;
  /** quantity × price after this line — except the buy line, where it is cost. */
  runningValue: DecimalInstance;
  source: HoldingPricePoint['source'] | 'purchase';
}

export interface HoldingRegister {
  lines: RegisterLine[];
  /** The last line's running value: the holding's value as the register tells it. */
  value: DecimalInstance;
  /** value − costBasis: what the register says has been gained or lost. */
  gain: DecimalInstance;
  /** Prices ignored because they predate the purchase. Counted, never hidden. */
  pricesBeforePurchase: number;
}

export function buildHoldingRegister(
  holding: {
    quantity: DecimalInstance;
    costBasis: DecimalInstance;
    purchaseDate: Date | null;
    purchasePrice: DecimalInstance | null;
  },
  /** The symbol's full series, any order; dated YYYY-MM-DD. */
  series: readonly HoldingPricePoint[]
): HoldingRegister {
  const purchaseDate = holding.purchaseDate
    ? holding.purchaseDate.toISOString().slice(0, 10)
    : null;

  // One price per day is the store's contract; sorting ascending makes each
  // line's "movement since the previous" well-defined.
  const usable = series
    .filter((p) => purchaseDate === null || p.date >= purchaseDate)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const pricesBeforePurchase = series.length - usable.length;

  const lines: RegisterLine[] = [
    {
      kind: 'buy',
      date: purchaseDate,
      price: holding.purchasePrice,
      amount: holding.costBasis,
      runningValue: holding.costBasis,
      source: 'purchase'
    }
  ];

  let running = holding.costBasis;
  for (const point of usable) {
    const price = toDecimal(point.price);
    const valueAt = holding.quantity.times(price);
    const movement = valueAt.minus(running);
    // A price identical to the running value's implied price moves nothing —
    // a zero line is noise, not information. (Common after an import that
    // repeats the last quote, or a same-day manual correction to the same
    // figure.)
    if (movement.isZero()) continue;
    lines.push({
      kind: 'revaluation',
      date: point.date,
      price,
      amount: movement,
      runningValue: valueAt,
      source: point.source
    });
    running = valueAt;
  }

  return {
    lines,
    value: running,
    gain: running.minus(holding.costBasis),
    pricesBeforePurchase
  };
}
