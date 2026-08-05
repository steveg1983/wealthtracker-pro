import { describe, it, expect } from 'vitest';
import { selectTopTransactions } from './topTransactions';
import type { Category, Transaction } from '../types';

/**
 * "Top Transactions" is a list of the biggest REAL money movements: what was
 * earned and what was spent. A transfer between the user's own accounts and a
 * revaluation of what something is worth are neither, and used to crowd the
 * list out — they are ruled out by category SEMANTICS (the shared classifier),
 * never by matching a name.
 */

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'type-income' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'detail', parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-2' },
  { id: 'type-revaluation', name: 'Revaluation', type: 'both', level: 'type', isSystem: true, isRevaluationCategory: true },
  { id: 'cat-reval', name: 'Market Value Change', type: 'both', level: 'detail', parentId: 'type-revaluation', isRevaluationCategory: true },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -10,
  description: 'synthetic row',
  category: 'cat-groceries',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

describe('selectTopTransactions', () => {
  it('lists real income and spending, never transfers or revaluations', () => {
    const rows = [
      txn({ id: 'spend', amount: -120, description: 'synthetic shop' }),
      // A transfer by TYPE — the biggest number in the set, and still not spending.
      txn({ id: 'move', amount: -9000, type: 'transfer', category: '', description: 'synthetic move' }),
      // A transfer by CATEGORY, filed as though it were money out.
      txn({ id: 'leg', amount: -7000, category: 'tofrom-savings', description: 'synthetic leg' }),
      // A revaluation: a change in what a holding is WORTH, not money received.
      txn({ id: 'reval', amount: 8000, type: 'income', category: 'cat-reval', description: 'synthetic valuation' }),
    ];

    expect(selectTopTransactions(rows, CATEGORIES).map(t => t.id)).toEqual(['spend']);
  });

  it('orders by SIZE of the movement, whichever way the money went', () => {
    const rows = [
      txn({ id: 'small', amount: -25 }),
      txn({ id: 'big-in', amount: 2000, type: 'income', category: 'cat-salary' }),
      txn({ id: 'big-out', amount: -3000 }),
    ];

    expect(selectTopTransactions(rows, CATEGORIES).map(t => t.id)).toEqual(['big-out', 'big-in', 'small']);
  });

  it('keeps unfiled rows — a payment with no category is still a real payment', () => {
    const rows = [
      txn({ id: 'unfiled', amount: -900, category: '', description: 'synthetic builder' }),
      txn({ id: 'filed', amount: -30 }),
    ];

    expect(selectTopTransactions(rows, CATEGORIES).map(t => t.id)).toEqual(['unfiled', 'filed']);
  });

  it('takes the ten biggest by default, and leaves the caller’s array untouched', () => {
    const rows = Array.from({ length: 15 }, (_, i) => txn({ id: `t${i}`, amount: -(i + 1) }));
    const order = rows.map(t => t.id);

    const top = selectTopTransactions(rows, CATEGORIES);

    expect(top).toHaveLength(10);
    expect(top[0]?.id).toBe('t14');
    expect(rows.map(t => t.id)).toEqual(order);
  });

  it('honours an explicit limit', () => {
    const rows = [txn({ id: 'a', amount: -5 }), txn({ id: 'b', amount: -50 })];

    expect(selectTopTransactions(rows, CATEGORIES, 1).map(t => t.id)).toEqual(['b']);
  });
});
