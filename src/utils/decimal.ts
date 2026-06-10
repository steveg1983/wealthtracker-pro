import Decimal from 'decimal.js';

export type DecimalInstance = InstanceType<typeof Decimal>;

// Configure Decimal for financial calculations
Decimal.config({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpPos: 30,
  toExpNeg: -30
});

/**
 * Convert a number or string to a Decimal instance
 */
export function toDecimal(value: number | string | DecimalInstance | null | undefined): DecimalInstance {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  return new Decimal(value);
}

/**
 * Convert a Decimal to a number (for display/storage)
 * Rounds to 2 decimal places
 */
export function toNumber(value: DecimalInstance): number {
  return value.toDecimalPlaces(2).toNumber();
}

/**
 * Format a Decimal for storage in the database
 * Returns a number rounded to 2 decimal places
 */
export function toStorageNumber(value: DecimalInstance): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Add multiple decimal values
 */
export function sumDecimals(values: (number | string | DecimalInstance)[]): DecimalInstance {
  return values.reduce((sum: DecimalInstance, value) => sum.plus(toDecimal(value)), new Decimal(0));
}

/**
 * Calculate percentage of a value
 */
export function calculatePercentage(value: DecimalInstance | number, percentage: DecimalInstance | number): DecimalInstance {
  return toDecimal(value).times(toDecimal(percentage)).dividedBy(100);
}

/**
 * Check if two decimal values are equal (within 0.01 tolerance for rounding)
 */
export function decimalsEqual(a: DecimalInstance | number, b: DecimalInstance | number, tolerance: number = 0.01): boolean {
  return toDecimal(a).minus(toDecimal(b)).abs().lessThanOrEqualTo(tolerance);
}

/**
 * Parse user-entered money text into a storage-safe number (2dp, HALF_UP).
 *
 * Strict where parseFloat is sloppy: parseFloat("12.34abc") silently returns
 * 12.34; this returns null for anything that isn't a plain signed decimal
 * after stripping currency symbols, thousands separators, and whitespace.
 *
 * Returns null for invalid input — callers decide how to surface that.
 */
export function parseMoneyInput(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw)
      ? new Decimal(raw).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
      : null;
  }
  const cleaned = raw.trim().replace(/[£$€,\s]/g, '');
  // Accepts "12", "12.34", ".5", "-7", "-.5" — rejects everything else.
  if (cleaned === '' || !/^-?(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) return null;
  return new Decimal(cleaned).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Export Decimal class for direct use
 */
export { Decimal };
