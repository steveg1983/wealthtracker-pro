import { parseMoneyInput } from './decimal';
import { formatDecimal } from './decimal-format';

/**
 * Text helpers for money entry fields: what the user may type, and how a
 * committed amount reads when the caret has left.
 *
 * Kept out of the component so both the field and anything that needs to
 * render an entered amount can share one definition of "grouped money".
 */

interface MoneyTextOptions {
  allowNegative?: boolean;
  decimals?: number;
}

/**
 * Strip a typed/pasted amount down to the characters a money field accepts.
 *
 * Commas survive so a pasted "£1,234.56" stays readable while the caret is in
 * the field; they are removed again before the value reaches the caller.
 */
export function sanitizeMoneyKeystroke(
  raw: string,
  { allowNegative = false, decimals = 2 }: MoneyTextOptions = {}
): string {
  const withoutSymbols = raw.replace(/[£$€\s]/g, '');
  const isNegative = allowNegative && withoutSymbols.trimStart().startsWith('-');
  const digitsOnly = withoutSymbols.replace(/[^0-9.,]/g, '');

  let body = digitsOnly;
  const firstDot = digitsOnly.indexOf('.');
  if (firstDot !== -1) {
    const integerPart = digitsOnly.slice(0, firstDot);
    // Later dots are typos, not separators — fold the rest into one fraction.
    const fractionPart = digitsOnly.slice(firstDot + 1).replace(/[.,]/g, '');
    body = decimals > 0 ? `${integerPart}.${fractionPart.slice(0, decimals)}` : integerPart;
  }

  return isNegative ? `-${body}` : body;
}

/** The value a caller stores: the display text with its grouping removed. */
export function stripGrouping(displayValue: string): string {
  return displayValue.replace(/,/g, '');
}

/**
 * The idle rendering of a money value: grouped to thousands, padded to
 * `decimals` — "1000000" reads as "1,000,000.00".
 *
 * Anything that is not a plain amount (a half-typed "12.", say) is handed back
 * untouched: a display helper must never destroy what someone is typing.
 */
export function formatMoneyForDisplay(
  value: string | number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    return Number.isFinite(value) ? formatDecimal(value, decimals, { group: true }) : '';
  }

  const trimmed = value.trim();
  if (trimmed === '') return '';

  const cleaned = stripGrouping(trimmed).replace(/[£$€\s]/g, '');
  // Validate with the shared money parser, but format from the string so the
  // digits never take a detour through a float.
  if (parseMoneyInput(cleaned) === null) return value;
  return formatDecimal(cleaned, decimals, { group: true });
}

/** True when a caller's state still reflects the raw value a field emitted. */
export function reflectsEmittedValue(
  value: string | number | null | undefined,
  emitted: string
): boolean {
  if (typeof value === 'string') {
    return value.trim() === emitted;
  }
  const emittedParsed = parseMoneyInput(emitted);
  // A half-typed amount ("12.", "-", "") carries no number to compare against,
  // so it cannot tell us the caller has taken over.
  if (emittedParsed === null) return true;
  if (value === null || value === undefined) return false;
  return parseMoneyInput(value) === emittedParsed;
}
