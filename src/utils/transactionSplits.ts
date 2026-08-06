import { toDecimal, parseMoneyInput, type DecimalInstance } from './decimal';
import type { Transaction, TransactionSplit, TransactionSplitInput } from '../types';

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
  /**
   * The stored line this draft was loaded from. Sent back on save so the
   * writer can match lines by identity instead of replacing the whole set —
   * the difference between "line 2 was re-categorised" and "line 1 (a transfer
   * leg) was deleted". Absent on lines the user has just added.
   */
  id?: string;
  /**
   * The account on the other side when this line is one leg of a transfer:
   * loaded from the stored row, or resolved from the "To/From <account>"
   * category the user picked.
   */
  transferAccountId?: string;
  /**
   * The target the STORED line carries, kept beside the live choice above so
   * the editor can tell a line that is BECOMING a transfer (its other side
   * gets created on save) from one that already was (it does not — a leg
   * whose counterpart has been deleted is re-paired, never duplicated, since
   * the missing row may simply be sitting in that account unmatched).
   */
  savedTransferAccountId?: string;
  /**
   * The counterpart transaction, when this leg is already linked to one. Such
   * a line is structural — its category, amount and target are pinned by the
   * row on the other side — so the editor renders it read-only and the writer
   * refuses to change it.
   */
  linkedTransferId?: string;
}

export type SplitDirection = 'income' | 'expense';

/**
 * Resolves a category id to the direction its TREE implies — 'income',
 * 'expense', or null for the direction-neutral categories (Revaluation,
 * Unassigned, blanks), which follow the parent transaction's direction.
 *
 * This is what lets one split MIX directions: a £30,000 payment can carry a
 * £40,000 expense line and a £10,000 income line, because the income line
 * counts AGAINST the expense total exactly as its category says it should.
 */
export type SplitDirectionFor = (categoryId: string) => SplitDirection | null;

interface SplitDirectionOpts {
  parentType: SplitDirection;
  directionFor: SplitDirectionFor;
}

/**
 * What validateSplitDrafts needs on top of direction, to judge TRANSFER lines
 * (a line that is itself one leg of a transfer — the Microsoft Money model).
 * Both fields are optional: surfaces that cannot produce a transfer line (the
 * pure maths tests, any caller without a category tree) simply never trip the
 * rules that read them.
 */
interface SplitValidationOpts extends SplitDirectionOpts {
  /** The account the parent transaction sits in. */
  parentAccountId?: string;
  /** True for a "To/From <account>" category (Category.isTransferCategory). */
  isTransferCategory?: (categoryId: string) => boolean;
}

/** The pre-mixing behaviour: every line follows the parent's direction. */
const FOLLOW_PARENT: SplitDirectionOpts = {
  parentType: 'expense',
  directionFor: () => null,
};

function lineDirection(line: SplitLineDraft, opts: SplitDirectionOpts): SplitDirection {
  return opts.directionFor(line.category) ?? opts.parentType;
}

/**
 * How much of the parent total the lines account for, in the ENTERED domain.
 * A line whose category runs WITH the parent adds; one whose category runs
 * COUNTER to it subtracts (£40,000 expense − £10,000 income = £30,000 of an
 * expense parent). Blank/invalid rows count as 0. Without opts, every line
 * follows the parent — the original single-direction behaviour.
 */
export function sumSplitDrafts(
  lines: SplitLineDraft[],
  opts: SplitDirectionOpts = FOLLOW_PARENT
): DecimalInstance {
  return lines.reduce((sum, line) => {
    const entered = toDecimal(parseMoneyInput(line.amount) ?? 0);
    const contribution = lineDirection(line, opts) === opts.parentType ? entered : entered.negated();
    return sum.plus(contribution);
  }, toDecimal(0));
}

/**
 * What is still left to allocate: entered total amount minus the split sum.
 * Zero (exactly) means the split is balanced and may be saved.
 */
export function splitRemainder(
  totalAmount: string,
  lines: SplitLineDraft[],
  opts: SplitDirectionOpts = FOLLOW_PARENT
): DecimalInstance {
  return toDecimal(parseMoneyInput(totalAmount) ?? 0).minus(sumSplitDrafts(lines, opts));
}

/**
 * Validate the draft against the save rules. Returns null when saveable,
 * otherwise the user-facing reason the save is blocked.
 *
 * The transfer-line rules mirror the ones set_transaction_splits_with_legs
 * enforces server-side, so the editor refuses before the round trip rather
 * than translating a database error afterwards. A transfer line counts toward
 * the parent total exactly like any other line — that is what makes
 * £30,000 (transferred) + £5,000 (interest) = the £35,000 that arrived.
 */
export function validateSplitDrafts(
  totalAmount: string,
  lines: SplitLineDraft[],
  opts: SplitValidationOpts = FOLLOW_PARENT
): string | null {
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
    // A To/From category names an account; without one the line says
    // "transfer" but cannot say where to, and there is no other side to make.
    if (opts.isTransferCategory?.(line.category) === true && !line.transferAccountId) {
      return 'A transfer line must name the account on the other side — that To/From category is not linked to an account.';
    }
    if (line.transferAccountId && line.transferAccountId === opts.parentAccountId) {
      return 'A transfer line must point at a different account — this one points back at the account the transaction is already in.';
    }
  }
  if (!splitRemainder(totalAmount, lines, opts).isZero()) {
    return 'The split total must match the transaction amount.';
  }
  return null;
}

/**
 * Convert entered magnitudes to DB-signed amounts. Expense-direction lines
 * store negative, income-direction lines positive — the direction being the
 * LINE's own (from its category), not the parent's, so a mixed split signs
 * each line correctly. An entered -20 on an expense line (cashback typed as
 * a minus) still lands as +20. The DB's set_transaction_splits invariant
 * (signed lines sum to the signed parent amount) holds exactly whenever
 * validateSplitDrafts passed with the same opts.
 *
 * Line identity and transfer targets travel with the amounts: the writer needs
 * both to match an edit against the stored lines rather than replacing them.
 */
export function signSplitAmounts(
  lines: SplitLineDraft[],
  type: SplitDirection,
  directionFor: SplitDirectionFor = () => null
): TransactionSplitInput[] {
  const opts: SplitDirectionOpts = { parentType: type, directionFor };
  return lines.map(line => {
    const entered = toDecimal(parseMoneyInput(line.amount) ?? 0);
    const signed = lineDirection(line, opts) === 'expense' ? entered.negated() : entered;
    return {
      category: line.category,
      // `plus(0)` normalises -0 → 0 to match signTransactionAmount's `|| 0`.
      amount: signed.plus(0).toNumber(),
      ...(line.memo?.trim() ? { memo: line.memo.trim() } : {}),
      ...(line.id ? { id: line.id } : {}),
      ...(line.transferAccountId ? { transferAccountId: line.transferAccountId } : {}),
    };
  });
}

/**
 * Does this line set say "one of these lines is a transfer"? The routing rule
 * for the write path: a set that declares a leg — a new one, or an existing
 * one being carried through an edit — goes to the writer that understands
 * legs; everything else takes the ordinary replace-the-set path, which stays
 * exactly as it was.
 */
export function splitDeclaresTransferLeg(lines: { transferAccountId?: string }[]): boolean {
  return lines.some(line => Boolean(line.transferAccountId));
}

/**
 * Convert a stored (signed) split amount back to the entered domain for the
 * editor — the inverse of signSplitAmounts, per line: pass the LINE's
 * resolved direction (its category's, falling back to the parent's).
 */
export function displaySplitAmount(storedAmount: number, direction: SplitDirection): string {
  const value = toDecimal(storedAmount);
  return (direction === 'expense' ? value.negated() : value).toString();
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
