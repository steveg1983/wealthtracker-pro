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

  it('falls back to the stored direction when the category gives no signal', () => {
    expect(classifyFlow(txn({ type: 'expense', category: '' }), kinds)).toBe('expense');
    expect(classifyFlow(txn({ type: 'income', category: 'cat-both' }), kinds)).toBe('income');
    expect(classifyFlow(txn({ type: 'income', category: 'nonexistent' }), kinds)).toBe('income');
  });

  it('transfers never count, by type or by transfer category', () => {
    expect(classifyFlow(txn({ type: 'transfer', category: 'tofrom-savings' }), kinds)).toBe('transfer');
    expect(classifyFlow(txn({ type: 'income', category: 'tofrom-savings' }), kinds)).toBe('transfer');
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
