import { toDecimal, type DecimalInstance } from '../../utils/decimal';

/**
 * The all-in average cost of a purchase: (units × price + charges) ÷ units.
 *
 * Microsoft Money's "average cost" is exactly this — total paid divided by
 * shares held, commission included — and it is what a broker's contract note
 * calls the figure too. The holding schema derives costBasis from averageCost
 * so the two can never disagree, which means charges (stamp duty, levies,
 * commission) have nowhere else to live: folding them here is what makes the
 * stored cost basis the money actually spent rather than the money spent on
 * shares alone.
 *
 * Charges must be in the SAME currency as the price. A charge in another
 * currency (a UK broker's commission on a US buy) belongs in the funding
 * transfer's total, not here — mixing currencies in one division would
 * manufacture a figure in no currency at all.
 */
export function allInAverageCost(
  quantity: DecimalInstance,
  averageCost: DecimalInstance,
  charges: DecimalInstance
): DecimalInstance {
  if (charges.lessThanOrEqualTo(0) || quantity.lessThanOrEqualTo(0)) return averageCost;
  return quantity.times(averageCost).plus(charges).dividedBy(quantity);
}

/**
 * What the purchase costs in cash: units × price + charges.
 *
 * The default for "total paid" when the funding account counts in the same
 * currency as the price — editable, because a real contract note can differ
 * by rounding. When the currencies differ there is no default: the true cash
 * figure is on the broker's note and only the owner has it.
 */
export function purchaseCashTotal(
  quantity: DecimalInstance,
  averageCost: DecimalInstance,
  charges: DecimalInstance
): DecimalInstance {
  // Charges are validated non-negative before they reach here; a negative
  // would mean a rebate, which is a different transaction, not a discount.
  return quantity.times(averageCost).plus(charges.greaterThan(0) ? charges : toDecimal(0));
}
