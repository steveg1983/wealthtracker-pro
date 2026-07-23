import { describe, it, expect } from 'vitest';
import { buildCategoryKindLookup, classifyFlow, computeIncomeExpense, bucketContribution } from './incomeExpense';
import type { Category, Transaction, TransactionSplit } from '../types';

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'type-income' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'cat-clothing', name: 'Clothing', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'cat-both', name: 'Ambiguous', type: 'both', level: 'detail', parentId: 'type-expense' },
  { id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'detail', parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-2' },
  { id: 'type-revaluation', name: 'Revaluation', type: 'both', level: 'type', isSystem: true, isRevaluationCategory: true },
  { id: 'cat-reval', name: 'Market Value Change', type: 'both', level: 'detail', parentId: 'type-revaluation', isRevaluationCategory: true },
  // The MS Money importer's bucket: a real 'both' category, but flagged so its
  // rows declassify to the review band instead of counting by direction.
  { id: 'cat-unassigned', name: 'Unassigned (MS Money import)', type: 'both', level: 'detail', parentId: 'type-expense', isUnassignedBucket: true },
];

const txn = (over: Partial<Transaction>): Transaction => ({
  id: 't1',
  date: new Date('2026-07-10'),
  amount: -10,
  description: 'x',
  category: '',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

describe('classifyFlow', () => {
  const kinds = buildCategoryKindLookup(CATEGORIES);

  it('classifies by category tree, not money direction', () => {
    // A refund: money IN (type income, positive) filed under an expense category.
    expect(classifyFlow(txn({ type: 'income', amount: 25, category: 'cat-clothing' }), kinds)).toBe('expense');
    // An income clawback: money OUT filed under an income category.
    expect(classifyFlow(txn({ type: 'expense', amount: -50, category: 'cat-salary' }), kinds)).toBe('income');
  });

  it('NO category (or a dangling id) → uncategorized, never a direction guess', () => {
    expect(classifyFlow(txn({ type: 'expense', category: '' }), kinds)).toBe('uncategorized');
    expect(classifyFlow(txn({ type: 'income', category: 'nonexistent' }), kinds)).toBe('uncategorized');
  });

  it("a REAL direction-neutral ('both') category was deliberately filed — direction decides its side, never the review list", () => {
    expect(classifyFlow(txn({ type: 'income', category: 'cat-both' }), kinds)).toBe('income');
    expect(classifyFlow(txn({ type: 'expense', category: 'cat-both' }), kinds)).toBe('expense');
  });

  it('transfers never count, by type or by transfer category', () => {
    expect(classifyFlow(txn({ type: 'transfer', category: 'tofrom-savings' }), kinds)).toBe('transfer');
    expect(classifyFlow(txn({ type: 'income', category: 'tofrom-savings' }), kinds)).toBe('transfer');
  });

  it('revaluation categories classify as revaluation, whatever the money direction', () => {
    // Portfolio up: money "in" (positive) filed under a revaluation category.
    expect(classifyFlow(txn({ type: 'income', amount: 5000, category: 'cat-reval' }), kinds)).toBe('revaluation');
    // Portfolio down: money "out" (negative) — still a revaluation, never spending.
    expect(classifyFlow(txn({ type: 'expense', amount: -3000, category: 'cat-reval' }), kinds)).toBe('revaluation');
  });

  it('an unassigned bucket declassifies the row — money in or out, never a direction guess', () => {
    // The importer had to file this line somewhere; the classifier must not read
    // that as the user choosing 'both'. Money in is NOT income here.
    expect(classifyFlow(txn({ type: 'income', amount: 5000, category: 'cat-unassigned' }), kinds)).toBe('uncategorized');
    expect(classifyFlow(txn({ type: 'expense', amount: -75, category: 'cat-unassigned' }), kinds)).toBe('uncategorized');
  });
});

describe('computeIncomeExpense', () => {
  it('a refund reduces expenses instead of inflating income', () => {
    const transactions: Transaction[] = [
      txn({ id: 'a', type: 'income', amount: 2500, category: 'cat-salary' }),
      txn({ id: 'b', type: 'expense', amount: -100, category: 'cat-clothing' }),
      // returned goods: money back in, expense category
      txn({ id: 'c', type: 'income', amount: 40, category: 'cat-clothing' }),
      txn({ id: 'd', type: 'transfer', amount: -500, category: 'tofrom-savings' }),
    ];
    const { income, expenses, incomeRows, expenseRows } = computeIncomeExpense(transactions, [], CATEGORIES);
    expect(income.toNumber()).toBe(2500);       // NOT 2540
    expect(expenses.toNumber()).toBe(60);       // 100 spent − 40 refunded
    expect(incomeRows.map(r => r.id)).toEqual(['a']);
    expect(expenseRows.map(r => r.id)).toEqual(['b', 'c']);
  });

  it('splits classify per line and the parent is not double-counted', () => {
    const transactions: Transaction[] = [
      txn({ id: 'p', type: 'expense', amount: -90, category: '', isSplit: true }),
    ];
    const splits: TransactionSplit[] = [
      { id: 's1', transactionId: 'p', category: 'cat-groceries', amount: -100, sortOrder: 1 },
      // cashback line inside the shop: positive, income category
      { id: 's2', transactionId: 'p', category: 'cat-salary', amount: 10, sortOrder: 2 },
    ];
    const { income, expenses } = computeIncomeExpense(transactions, splits, CATEGORIES);
    expect(expenses.toNumber()).toBe(100);
    expect(income.toNumber()).toBe(10);
  });

  it('uncategorised rows hit NO total and are listed for review', () => {
    const transactions: Transaction[] = [
      txn({ id: 'a', type: 'income', amount: 2500, category: 'cat-salary' }),
      // a £250k "Adjustment" credit with no category must NOT be income
      txn({ id: 'b', type: 'income', amount: 250000, category: '' }),
      txn({ id: 'c', type: 'expense', amount: -75, category: '' }),
    ];
    const { income, expenses, uncategorizedRows, uncategorizedIn, uncategorizedOut } =
      computeIncomeExpense(transactions, [], CATEGORIES);
    expect(income.toNumber()).toBe(2500);
    expect(expenses.toNumber()).toBe(0);
    expect(uncategorizedRows.map(r => r.id)).toEqual(['b', 'c']);
    expect(uncategorizedIn.toNumber()).toBe(250000);
    expect(uncategorizedOut.toNumber()).toBe(75);
  });

  it('revaluations net signed on their own line — never income, expenses or review', () => {
    const transactions: Transaction[] = [
      txn({ id: 'a', type: 'income', amount: 2500, category: 'cat-salary' }),
      txn({ id: 'b', type: 'expense', amount: -100, category: 'cat-groceries' }),
      // portfolio up, then partly down — signed, they net against each other
      txn({ id: 'up', type: 'income', amount: 5000, category: 'cat-reval' }),
      txn({ id: 'down', type: 'expense', amount: -2000, category: 'cat-reval' }),
    ];
    const { income, expenses, revaluation, revaluationRows, uncategorizedRows } =
      computeIncomeExpense(transactions, [], CATEGORIES);
    expect(income.toNumber()).toBe(2500);           // the +5000 is NOT income
    expect(expenses.toNumber()).toBe(100);          // the −2000 is NOT spending
    expect(revaluation.toNumber()).toBe(3000);      // 5000 − 2000, signed
    expect(revaluationRows.map(r => r.id)).toEqual(['up', 'down']);
    // Classified rows leave the review band — a revaluation is not uncategorised.
    expect(uncategorizedRows).toHaveLength(0);
  });

  it('a downward revaluation is a fall in value, not spending', () => {
    const { expenses, revaluation, expenseRows } = computeIncomeExpense(
      [txn({ id: 'crash', type: 'expense', amount: -4000, category: 'cat-reval' })],
      [],
      CATEGORIES
    );
    expect(expenses.toNumber()).toBe(0);
    expect(expenseRows).toHaveLength(0);
    expect(revaluation.toNumber()).toBe(-4000);
  });

  it('an unassigned bucket is not income or spending — it goes to the review band', () => {
    const transactions: Transaction[] = [
      txn({ id: 'a', type: 'income', amount: 2500, category: 'cat-salary' }),
      // a large credit the importer parked in the bucket must NOT be income
      txn({ id: 'in', type: 'income', amount: 9000, category: 'cat-unassigned' }),
      txn({ id: 'out', type: 'expense', amount: -60, category: 'cat-unassigned' }),
    ];
    const { income, expenses, uncategorizedRows, uncategorizedIn, uncategorizedOut } =
      computeIncomeExpense(transactions, [], CATEGORIES);
    expect(income.toNumber()).toBe(2500);          // the +9000 bucket line is NOT income
    expect(expenses.toNumber()).toBe(0);           // the −60 bucket line is NOT spending
    expect(uncategorizedRows.map(r => r.id)).toEqual(['in', 'out']);
    expect(uncategorizedIn.toNumber()).toBe(9000);
    expect(uncategorizedOut.toNumber()).toBe(60);
  });

  it('a split LINE carrying the bucket is uncategorised too, never income', () => {
    const transactions: Transaction[] = [
      txn({ id: 'p', type: 'expense', amount: -90, category: '', isSplit: true }),
    ];
    const splits: TransactionSplit[] = [
      { id: 's1', transactionId: 'p', category: 'cat-groceries', amount: -100, sortOrder: 1 },
      // the remainder Money left unassigned, parked in the bucket by the importer
      { id: 's2', transactionId: 'p', category: 'cat-unassigned', amount: 10, sortOrder: 2 },
    ];
    const { income, expenses, uncategorizedRows, uncategorizedIn } =
      computeIncomeExpense(transactions, splits, CATEGORIES);
    expect(expenses.toNumber()).toBe(100);
    expect(income.toNumber()).toBe(0);             // the +10 bucket line is not income
    expect(uncategorizedRows.map(r => r.id)).toEqual(['p::split::s2']);
    expect(uncategorizedIn.toNumber()).toBe(10);
  });

  it('bounds by date when from/to given', () => {
    const transactions: Transaction[] = [
      txn({ id: 'old', date: new Date('2020-01-01'), type: 'expense', amount: -10, category: 'cat-groceries' }),
      txn({ id: 'new', date: new Date('2026-07-01'), type: 'expense', amount: -20, category: 'cat-groceries' }),
    ];
    const { expenses } = computeIncomeExpense(transactions, [], CATEGORIES, { from: new Date('2026-01-01') });
    expect(expenses.toNumber()).toBe(20);
  });
});

describe('bucketContribution', () => {
  it('signs rows so a breakdown list sums to its total', () => {
    expect(bucketContribution({ amount: -100 }, 'expense')).toBe(100);
    expect(bucketContribution({ amount: 40 }, 'expense')).toBe(-40); // refund credit
    expect(bucketContribution({ amount: 2500 }, 'income')).toBe(2500);
  });
});
