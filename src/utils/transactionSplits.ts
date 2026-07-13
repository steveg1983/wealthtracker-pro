import { toDecimal, parseMoneyInput, type DecimalInstance } from './decimal';

/**
 * Split-editor money maths. Everything runs through Decimal — the "totals
 * must match" rule is an exact comparison, never a float one.
 *
 * The editor works in the ENTERED domain: the user types magnitudes the same
 * way the main Amount field collects them (positive for a normal line; a
 * MINUS line models e.g. cashback inside a shop, reducing the total). Signing
 * to the DB convention (expenses negative) happens once at save time via
 * signSplitAmounts.
 */

/** One editor row: category id + the raw amount string as typed. */
export interface SplitLineDraft {
  category: string;
  amount: string;
  memo?: string;
}

/** Sum of the entered split amounts; blank/invalid rows count as 0. */
export function sumSplitDrafts(lines: SplitLineDraft[]): DecimalInstance {
  return lines.reduce(
    (sum, line) => sum.plus(parseMoneyInput(line.amount) ?? 0),
    toDecimal(0)
  );
}

/**
 * What is still left to allocate: entered total amount minus the split sum.
 * Zero (exactly) means the split is balanced and may be saved.
 */
export function splitRemainder(totalAmount: string, lines: SplitLineDraft[]): DecimalInstance {
  return toDecimal(parseMoneyInput(totalAmount) ?? 0).minus(sumSplitDrafts(lines));
}

/**
 * Validate the draft against the save rules. Returns null when saveable,
 * otherwise the user-facing reason the save is blocked.
 */
export function validateSplitDrafts(totalAmount: string, lines: SplitLineDraft[]): string | null {
  if (lines.length < 2) {
    return 'A split needs at least two category lines.';
  }
  for (const line of lines) {
    if (!line.category) {
      return 'Every split line needs a category.';
    }
    const amount = parseMoneyInput(line.amount);
    if (amount === null || toDecimal(amount).isZero()) {
      return 'Every split line needs a non-zero amount.';
    }
  }
  if (!splitRemainder(totalAmount, lines).isZero()) {
    return 'The split total must match the transaction amount.';
  }
  return null;
}

/**
 * Convert entered magnitudes to DB-signed amounts. Expenses store negative,
 * so an entered 120 becomes -120 and an entered -20 (a cashback line)
 * becomes +20; income lines keep their entered sign. This mirrors what
 * signTransactionAmount does to the single amount field, extended to allow
 * per-line negatives.
 */
export function signSplitAmounts(
  lines: SplitLineDraft[],
  type: 'income' | 'expense'
): { category: string; amount: number; memo?: string }[] {
  return lines.map(line => {
    const entered = toDecimal(parseMoneyInput(line.amount) ?? 0);
    const signed = type === 'expense' ? entered.negated() : entered;
    return {
      category: line.category,
      // `plus(0)` normalises -0 → 0 to match signTransactionAmount's `|| 0`.
      amount: signed.plus(0).toNumber(),
      ...(line.memo?.trim() ? { memo: line.memo.trim() } : {}),
    };
  });
}

/**
 * Convert stored (signed) split amounts back to the entered domain for the
 * editor — the inverse of signSplitAmounts.
 */
export function displaySplitAmount(storedAmount: number, type: 'income' | 'expense'): string {
  const value = toDecimal(storedAmount);
  return (type === 'expense' ? value.negated() : value).toString();
}
