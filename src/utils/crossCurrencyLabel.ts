import { toDecimal } from './decimal';
import { formatCurrency } from './currency-decimal';

/**
 * A figure that must not be read in the wrong currency: "USD -$100.00".
 *
 * ── WHY THE CODE IS PRINTED BESIDE A SYMBOL THAT ALREADY IMPLIES IT ─────────
 *
 * Everywhere else in the app a figure is shown with its symbol alone, and that
 * is right: a register belongs to one account, so its currency is a fact about
 * the whole page rather than about each row. A cross-currency SUGGESTION is the
 * one place that stops being true — two figures sit side by side, they will not
 * match, and the reason is the very thing the symbols cannot say. "$" is the
 * dollar of at least four countries the app's own rate table carries, and "-£"
 * beside "-$" reads as a broken match rather than a conversion.
 *
 * So the code is spelled out, in the same shape the engines use when they
 * refuse a pair — `({first_currency} {first} vs {second_currency} {second})` in
 * `transfer::amounts_not_opposite_across_currencies`. A user who meets both the
 * refusal and the offer meets one notation.
 *
 * This is the ONLY place that notation is written down, because it appears in
 * three unrelated surfaces (the match dialog, the register dock's strip and the
 * bulk sweep's table) and three spellings of it would drift.
 *
 * The SIGN is always explicit, including the leading "+", which the app's
 * display rules reserve for income. Here it is not decoration: opposite-in-sign
 * is the entire test these two rows passed to be shown together, so a reader
 * comparing them is reading the signs as the evidence.
 */
export function amountWithCurrencyCode(amount: number, currency: string): string {
  const decimal = toDecimal(amount);
  // The magnitude is formatted, and the sign written beside it, so a negative
  // never renders as "USD --$100.00".
  return `${currency} ${decimal.isNegative() ? '-' : '+'}${formatCurrency(decimal.abs(), currency)}`;
}
