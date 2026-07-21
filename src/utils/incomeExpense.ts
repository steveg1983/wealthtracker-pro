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
 *  - a category from the income tree → income; expense tree → expense —
 *    regardless of the money's direction;
 *  - no category / an unknown or direction-neutral ('both') category → fall
 *    back to the stored direction, the only signal left.
 *
 * Split transactions classify PER LINE (a split can mix categories), with the
 * parent never double-counted.
 */

export type FlowKind = 'income' | 'expense' | 'transfer';

/** category id → its flow kind (null = no categorical signal, e.g. 'both'). */
export function buildCategoryKindLookup(categories: Category[]): Map<string, FlowKind | null> {
  const lookup = new Map<string, FlowKind | null>();
  for (const c of categories) {
    if (c.isTransferCategory === true || c.id === 'type-transfer' || c.parentId === 'type-transfer') {
      lookup.set(c.id, 'transfer');
    } else if (c.type === 'income' || c.type === 'expense') {
      lookup.set(c.id, c.type);
    } else {
      lookup.set(c.id, null);
    }
  }
  return lookup;
}

export function classifyFlow(
  row: Pick<Transaction, 'type' | 'category'>,
  categoryKinds: Map<string, FlowKind | null>
): FlowKind {
  if (row.type === 'transfer') return 'transfer';
  const kind = row.category ? categoryKinds.get(row.category) : undefined;
  if (kind === 'income' || kind === 'expense' || kind === 'transfer') return kind;
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
  const incomeRows: SplitExpandedTransaction[] = [];
  const expenseRows: SplitExpandedTransaction[] = [];

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
    }
  }

  return { income, expenses, incomeRows, expenseRows };
}

/**
 * A row's signed contribution to its bucket's total: positive for ordinary
 * income/spending, negative for a credit (refund) — what a breakdown list
 * should display so its rows visibly sum to the header figure.
 */
export function bucketContribution(row: Pick<Transaction, 'amount'>, bucket: 'income' | 'expense'): number {
  return bucket === 'income' ? row.amount : toDecimal(row.amount).negated().toNumber();
}
