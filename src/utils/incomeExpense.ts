import type { Category, Transaction, TransactionSplit } from '../types';
import { toDecimal, type DecimalInstance } from './decimal';
import { expandSplitTransactions, type SplitExpandedTransaction } from './transactionSplits';

/**
 * Income/expense classification by CATEGORY SEMANTICS — the Microsoft Money
 * model, and the single definition every aggregation surface must share.
 *
 * A transaction's `type` records the DIRECTION money moved (in/out), not what
 * it *was*. A store refund arrives INTO a bank account but is filed under an
 * expense category — it is an expense CREDIT that reduces spending, never
 * income. Likewise a clawback filed under an income category reduces income.
 * The edit modal supports this ("cross-type" filing) as a first-class
 * concept; classifying by direction instead of category over-states both
 * income and expenditure by every such credit.
 *
 * Rules:
 *  - transfers never count (neither the type nor transfer categories);
 *  - revaluation categories never count towards income or expenses either — a
 *    change in an account's VALUE (a portfolio revaluation) is not money earned
 *    or spent, it is an increase or decrease to net worth. The balances already
 *    include it; the classifier only decides which LINE reports it on;
 *  - a category from the income tree → income; expense tree → expense —
 *    regardless of the money's direction;
 *  - NO category (or an unknown / direction-neutral one) → the row does NOT
 *    hit the report at all. Direction is never guessed: an uncategorised
 *    credit is not income and an uncategorised debit is not spending — it is
 *    unclassified data the user needs to file (Steve: "no category shouldn't
 *    be tagged as income or expense in a report — forces people to keep
 *    their data clean"). Reports surface these rows separately for review;
 *  - an UNASSIGNED BUCKET category → treated exactly like NO category. The MS
 *    Money importer files split lines under a real "Unassigned" category ONLY
 *    because the splits schema forbids a blank one; that filing was the
 *    importer's, not the user's. Left as an ordinary 'both' category its
 *    money-in lines would count as income by the direction fallback above —
 *    the very guess the no-category rule exists to stop, wearing a category id
 *    as a disguise (Steve: "if it was unassigned, it isn't income"). The
 *    is_unassigned_bucket flag DECLASSIFIES the row back to uncategorised.
 *
 * Split transactions classify PER LINE (a split can mix categories), with the
 * parent never double-counted.
 */

export type FlowKind = 'income' | 'expense' | 'transfer' | 'revaluation' | 'uncategorized';

/** A single category's flow kind (null = no categorical signal, e.g. 'both'). */
export function categoryKindOf(c: Category | undefined): FlowKind | null {
  if (!c) return null;
  // Transfer keeps precedence: it is the older concept and a category can't
  // sensibly be both. Revaluation is the same shape one rung down — its own
  // kind, ruled out of income/expense by category semantics.
  if (c.isTransferCategory === true || c.id === 'type-transfer' || c.parentId === 'type-transfer') {
    return 'transfer';
  }
  if (c.isRevaluationCategory === true) return 'revaluation';
  // An unassigned bucket is not a classification: its OWN kind IS
  // 'uncategorized'. The importer parks Money's uncategorised remainder here
  // because a split line cannot be blank; classifyFlow then passes this kind
  // straight through, keeping the row OUT of the 'both' direction fallback that
  // would otherwise read a money-in line as income.
  if (c.isUnassignedBucket === true) return 'uncategorized';
  if (c.type === 'income' || c.type === 'expense') return c.type;
  return null;
}

/** category id → its flow kind (null = no categorical signal, e.g. 'both'). */
export function buildCategoryKindLookup(categories: Category[]): Map<string, FlowKind | null> {
  return new Map(categories.map(c => [c.id, categoryKindOf(c)]));
}

export function classifyFlow(
  row: Pick<Transaction, 'type' | 'category'>,
  categoryKinds: Map<string, FlowKind | null>
): FlowKind {
  if (row.type === 'transfer') return 'transfer';
  // 'uncategorized' means STRICTLY that: no category at all, or a dangling
  // id. A row with any real category never lands in the review list.
  if (!row.category || !categoryKinds.has(row.category)) return 'uncategorized';
  const kind = categoryKinds.get(row.category);
  // A category that declares its OWN kind is taken at its word, never overridden
  // by the money's direction — including 'uncategorized', which an unassigned
  // bucket returns to declassify itself back into the review band.
  if (
    kind === 'income' || kind === 'expense' || kind === 'transfer' ||
    kind === 'revaluation' || kind === 'uncategorized'
  ) {
    return kind;
  }
  // A real but direction-neutral ('both') category: the user DID file it —
  // the money's direction decides which side of the report it lands on.
  return row.type === 'income' ? 'income' : 'expense';
}

export interface IncomeExpenseBreakdown {
  /** Net income: income-category credits minus income-category debits. */
  income: DecimalInstance;
  /** Net spending as a POSITIVE magnitude: debits minus refunds/credits. */
  expenses: DecimalInstance;
  /** The rows behind each total (split lines, not their parents). */
  incomeRows: SplitExpandedTransaction[];
  expenseRows: SplitExpandedTransaction[];
  /**
   * Rows with no usable category — EXCLUDED from both totals, listed here so
   * reports can show a "needs a category" review affordance. Money in/out
   * are the signed sums of these rows (for display only, never totals).
   */
  uncategorizedRows: SplitExpandedTransaction[];
  uncategorizedIn: DecimalInstance;
  uncategorizedOut: DecimalInstance;
  /**
   * Net change in VALUE from revaluation-category rows — SIGNED (an upward
   * revaluation is positive, a downward one negative). Never part of income or
   * expenses: a portfolio moving up is not income and a portfolio moving down
   * is not spending, and the account balances already carry the change. The
   * classification only decides that these rows report on their OWN line, so a
   * report can show them without ever letting them distort what was earned or
   * spent.
   */
  revaluation: DecimalInstance;
  revaluationRows: SplitExpandedTransaction[];
}

/**
 * Aggregate income and expenses over a set of transactions using category
 * semantics. `from`/`to` bound by transaction date (inclusive) when given.
 */
export function computeIncomeExpense(
  transactions: Transaction[],
  transactionSplits: TransactionSplit[],
  categories: Category[],
  opts: { from?: Date; to?: Date } = {}
): IncomeExpenseBreakdown {
  const kinds = buildCategoryKindLookup(categories);

  const inRange = (t: Transaction): boolean => {
    const time = new Date(t.date).getTime();
    if (opts.from && time < opts.from.getTime()) return false;
    if (opts.to && time > opts.to.getTime()) return false;
    return true;
  };

  const rows = expandSplitTransactions(transactions.filter(inRange), transactionSplits);

  let income = toDecimal(0);
  let expenses = toDecimal(0);
  let uncategorizedIn = toDecimal(0);
  let uncategorizedOut = toDecimal(0);
  let revaluation = toDecimal(0);
  const incomeRows: SplitExpandedTransaction[] = [];
  const expenseRows: SplitExpandedTransaction[] = [];
  const uncategorizedRows: SplitExpandedTransaction[] = [];
  const revaluationRows: SplitExpandedTransaction[] = [];

  for (const row of rows) {
    const kind = classifyFlow(row, kinds);
    if (kind === 'income') {
      income = income.plus(toDecimal(row.amount));
      incomeRows.push(row);
    } else if (kind === 'expense') {
      // Expenses are stored negative, so negating yields positive spending —
      // and a positive-amount credit (refund) correctly SUBTRACTS.
      expenses = expenses.plus(toDecimal(row.amount).negated());
      expenseRows.push(row);
    } else if (kind === 'revaluation') {
      // Signed as stored: an upward revaluation (+) and a downward one (−) net
      // against each other. Deliberately touches NEITHER income nor expenses —
      // a value change is not money earned or spent.
      revaluation = revaluation.plus(toDecimal(row.amount));
      revaluationRows.push(row);
    } else if (kind === 'uncategorized') {
      const amount = toDecimal(row.amount);
      if (amount.greaterThanOrEqualTo(0)) uncategorizedIn = uncategorizedIn.plus(amount);
      else uncategorizedOut = uncategorizedOut.plus(amount.abs());
      uncategorizedRows.push(row);
    }
  }

  return {
    income, expenses, incomeRows, expenseRows,
    uncategorizedRows, uncategorizedIn, uncategorizedOut,
    revaluation, revaluationRows,
  };
}

/**
 * A row's signed contribution to its bucket's total: positive for ordinary
 * income/spending, negative for a credit (refund) — what a breakdown list
 * should display so its rows visibly sum to the header figure.
 */
export function bucketContribution(row: Pick<Transaction, 'amount'>, bucket: 'income' | 'expense'): number {
  return bucket === 'income' ? row.amount : toDecimal(row.amount).negated().toNumber();
}
