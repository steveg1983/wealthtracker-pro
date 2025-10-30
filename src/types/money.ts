// Branded Money type to avoid accidental float usage for financial amounts
export type Money = string & { readonly __brand: 'Money' };

// Create Money from a number or string (normalized to 2 decimal places)
import { toDecimal, formatDecimalFixed } from '@wealthtracker/utils';
import type { DecimalInstance } from '@wealthtracker/utils';

export function toMoney(value: number | string | DecimalInstance): Money {
  const decimalValue = toDecimal(value);
  if (!decimalValue.isFinite()) throw new Error('Invalid money value');
  return formatDecimalFixed(decimalValue, 2) as Money;
}

// Add two Money values (as strings) precisely by using integer cents
export function addMoney(a: Money, b: Money): Money {
  const sumDecimal = toDecimal(a).plus(toDecimal(b));
  return toMoney(sumDecimal);
}

// Compare two Money values
export function compareMoney(a: Money, b: Money): number {
  const na = Number(a);
  const nb = Number(b);
  return na === nb ? 0 : na < nb ? -1 : 1;
}

// Utility to get absolute value
export function absMoney(a: Money): Money {
  return toMoney(Math.abs(Number(a)));
}
