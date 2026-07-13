import { toDecimal, parseMoneyInput, type DecimalInstance } from './decimal';
import type { Transaction, TransactionSplit } from '../types';

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

/**
 * A transaction as seen by CATEGORY-AGGREGATION surfaces: either a real
 * transaction passed through, or one line of a split parent projected into a
 * virtual row that carries the line's category and amount.
 */
export interface SplitExpandedTransaction extends Transaction {
  /** True for a virtual row projected from one split line. */
  isSplitLine?: boolean;
  /** The real transaction the line belongs to (open THIS in editors). */
  splitParentId?: string;
}

/** Group splits by their parent transaction id, in sort order. */
export function splitsByTransaction(splits: TransactionSplit[]): Map<string, TransactionSplit[]> {
  const map = new Map<string, TransactionSplit[]>();
  for (const split of splits) {
    const list = map.get(split.transactionId);
    if (list) {
      list.push(split);
    } else {
      map.set(split.transactionId, [split]);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
}

/**
 * Expand split parents into per-line virtual rows for CATEGORY aggregation
 * (counters, category transaction lists, budgets, analytics, exports).
 *
 * - Non-split transactions pass through untouched.
 * - A split parent is REPLACED by one row per line: same date/payee/account,
 *   the line's category and signed amount, a synthetic id, and splitParentId
 *   pointing back at the real row. Line amounts sum to the parent amount by
 *   the set_transaction_splits invariant, so totals stay exact.
 * - A parent whose lines are missing (splits not loaded yet) passes through
 *   unchanged rather than vanishing from view.
 *
 * NEVER feed the result into balance arithmetic, the account register, or
 * any write path — virtual rows have synthetic ids and exist only so
 * "amount per category" style views can treat split lines as first-class.
 */
export function expandSplitTransactions(
  transactions: Transaction[],
  splits: TransactionSplit[]
): SplitExpandedTransaction[] {
  if (splits.length === 0) {
    return transactions;
  }
  const byTransaction = splitsByTransaction(splits);
  const expanded: SplitExpandedTransaction[] = [];
  for (const transaction of transactions) {
    const lines = transaction.isSplit ? byTransaction.get(transaction.id) : undefined;
    if (!lines || lines.length === 0) {
      expanded.push(transaction);
      continue;
    }
    for (const line of lines) {
      expanded.push({
        ...transaction,
        id: `${transaction.id}::split::${line.id}`,
        category: line.category,
        amount: line.amount,
        // Sign⇄type coherence: a positive line inside an expense split (e.g.
        // cashback) behaves like the cross-type income filing consumers
        // already understand — aggregators that abs() expense amounts must
        // not count it as MORE spending.
        type: line.amount >= 0 ? 'income' : 'expense',
        notes: line.memo ?? transaction.notes,
        isSplitLine: true,
        splitParentId: transaction.id,
      });
    }
  }
  return expanded;
}
