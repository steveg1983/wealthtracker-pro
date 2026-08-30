/**
 * A position's snapshot row, re-derived from its surviving trades.
 *
 * Deleting one trade (owner, 30 Aug: a buy recorded against the wrong fund
 * — "I want to delete it") leaves the holding row's pooled quantity and
 * average cost describing a history that no longer exists. This fold is the
 * registers' own s.104 arithmetic — buys add quantity and cost, sells and
 * write-offs remove their proportional share of the pool — run over what
 * remains, so the snapshot says what the surviving trades say.
 *
 * Null when nothing survives: an empty position has no snapshot to state,
 * and the caller refuses the deletion up front rather than leaving a
 * holding row that claims units no trade delivered.
 */

import { toDecimal, type DecimalInstance } from '../../utils/decimal';

export interface EventForRefold {
  kind: 'buy' | 'sell' | 'write_off';
  /** Decimal strings, as the events carry them. */
  quantity: string;
  amount: string;
}

export function refoldPosition(
  events: readonly EventForRefold[]
): { quantity: DecimalInstance; averageCost: DecimalInstance } | null {
  let poolQty = toDecimal('0');
  let poolCost = toDecimal('0');
  for (const event of events) {
    const quantity = toDecimal(event.quantity);
    if (event.kind === 'buy') {
      poolQty = poolQty.plus(quantity);
      poolCost = poolCost.plus(toDecimal(event.amount));
    } else {
      // Sells and write-offs leave at pooled cost — the registers' rule.
      const leaving = quantity.greaterThan(poolQty) ? poolQty : quantity;
      const costOut = poolQty.isZero() ? toDecimal('0') : poolCost.times(leaving).dividedBy(poolQty);
      poolQty = poolQty.minus(leaving);
      poolCost = poolCost.minus(costOut);
    }
  }
  if (poolQty.isZero() || poolQty.isNegative()) return null;
  return { quantity: poolQty, averageCost: poolCost.dividedBy(poolQty) };
}
