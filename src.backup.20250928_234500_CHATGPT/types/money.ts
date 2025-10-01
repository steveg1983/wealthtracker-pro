// Branded Money type to avoid accidental float usage for financial amounts
export type Money = string & { readonly __brand: 'Money' };

// Create Money from a number or string (normalized to 2 decimal places)
export function toMoney(value: number | string): Money {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error('Invalid money value');
  return (n.toFixed(2) as unknown) as Money;
}

// Add two Money values (as strings) precisely by using integer cents
export function addMoney(a: Money, b: Money): Money {
  const cents = (v: Money) => Math.round(Number(v) * 100);
  const sum = cents(a) + cents(b);
  return toMoney(sum / 100);
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

