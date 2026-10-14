/**
 * One evaluation of a budget, for every surface that quotes one.
 *
 * The Dashboard's Budget Status card summed a budget's own category over a
 * rolling thirty days against the base amount; the Budget page measured the
 * budget's real window, rolled groups up, healed legacy category names and
 * carried rollovers in. Same budget, two figures. These specs pin the one
 * evaluation both now share — above all the WINDOW, which is what made the
 * Dashboard's figure unanswerable ("what period is that for?").
 */

import { describe, it, expect } from 'vitest';
import { evaluateBudgets, buildBudgetCategoryResolver } from './budgetEvaluation';
import { expandSplitTransactions } from './transactionSplits';
import type { Budget, Category, Transaction, TransactionSplit } from '../types';

const NOW = new Date(2026, 9, 15, 12, 0, 0); // 15 October 2026, local

const categories: Category[] = [
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'sub' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'cat-food' },
  { id: 'cat-eating-out', name: 'Eating out', type: 'expense', level: 'detail', parentId: 'cat-food' },
  { id: 'cat-fuel', name: 'Fuel', type: 'expense', level: 'detail' },
];

const budget = (over: Partial<Budget> & { id: string; categoryId: string }): Budget => ({
  amount: 500,
  period: 'monthly',
  isActive: true,
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 0, 1),
  spent: 0,
  ...over,
});

const row = (over: Partial<Transaction> & { id: string; date: Date; amount: number }): Transaction => ({
  description: 'A row',
  type: over.amount < 0 ? 'expense' : 'income',
  accountId: 'acc-gbp',
  category: 'cat-groceries',
  cleared: false,
  ...over,
} as Transaction);

describe('evaluateBudgets — the window is the budget’s own, not a rolling month', () => {
  const monthly = budget({ id: 'b-groceries', categoryId: 'cat-groceries' });

  it('counts the whole calendar month, including days more than thirty ago', () => {
    const transactions = [
      row({ id: 'first-of-month', date: new Date(2026, 9, 1), amount: -120 }),
      row({ id: 'yesterday', date: new Date(2026, 9, 14), amount: -80 }),
    ];

    const [result] = evaluateBudgets([monthly], { transactions, categories, now: NOW });

    expect(result.spent.toNumber()).toBe(200);
    expect(result.window.label).toBe('Monthly');
    expect(result.window.start).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(result.window.end).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });

  it('leaves last month out, however recent — the Dashboard’s old thirty days took it', () => {
    const transactions = [
      row({ id: 'late-september', date: new Date(2026, 8, 28), amount: -300 }),
      row({ id: 'this-month', date: new Date(2026, 9, 3), amount: -50 }),
    ];

    const [result] = evaluateBudgets([monthly], { transactions, categories, now: NOW });

    expect(result.spent.toNumber()).toBe(50);
    expect(Array.from(result.countedRowIds)).toEqual(['this-month']);
  });

  it('names exactly the rows it summed, split lines by their own id', () => {
    const transactions = [
      row({ id: 'shop', date: new Date(2026, 9, 5), amount: -100, category: '' , isSplit: true }),
      row({ id: 'fuel', date: new Date(2026, 9, 6), amount: -40, category: 'cat-fuel' }),
    ];
    const splits: TransactionSplit[] = [
      { id: 's1', transactionId: 'shop', category: 'cat-groceries', amount: -70, sortOrder: 0 },
      { id: 's2', transactionId: 'shop', category: 'cat-fuel', amount: -30, sortOrder: 1 },
    ];
    const expanded = expandSplitTransactions(transactions, splits);
    const groceriesLine = expanded.find(r => r.isSplitLine && r.category === 'cat-groceries');
    expect(groceriesLine).toBeDefined();

    const [result] = evaluateBudgets([monthly], { transactions, transactionSplits: splits, categories, now: NOW });

    expect(result.spent.toNumber()).toBe(70);
    expect(Array.from(result.countedRowIds)).toEqual([groceriesLine!.id]);
  });

  it('nets a refund off the spend', () => {
    const transactions = [
      row({ id: 'spend', date: new Date(2026, 9, 2), amount: -90 }),
      row({ id: 'refund', date: new Date(2026, 9, 9), amount: 30, type: 'income' }),
    ];

    const [result] = evaluateBudgets([monthly], { transactions, categories, now: NOW });

    expect(result.spent.toNumber()).toBe(60);
    expect(result.countedRowIds.size).toBe(2);
  });
});

describe('evaluateBudgets — what the Budget page always did, now shared', () => {
  it('rolls a group budget’s children up, and nothing outside the group', () => {
    const group = budget({ id: 'b-food', categoryId: 'cat-food', amount: 1000 });
    const transactions = [
      row({ id: 'g', date: new Date(2026, 9, 2), amount: -100, category: 'cat-groceries' }),
      row({ id: 'e', date: new Date(2026, 9, 3), amount: -60, category: 'cat-eating-out' }),
      row({ id: 'f', date: new Date(2026, 9, 4), amount: -40, category: 'cat-fuel' }),
    ];

    const [result] = evaluateBudgets([group], { transactions, categories, now: NOW });

    expect(result.spent.toNumber()).toBe(160);
    expect(result.countedRowIds).toEqual(new Set(['g', 'e']));
  });

  it('heals a budget saved with the category NAME where the id belongs', () => {
    const legacy = budget({ id: 'b-legacy', categoryId: 'Groceries' });
    const transactions = [row({ id: 'g', date: new Date(2026, 9, 2), amount: -25 })];

    const [result] = evaluateBudgets([legacy], { transactions, categories, now: NOW });

    expect(result.categoryId).toBe('cat-groceries');
    expect(result.spent.toNumber()).toBe(25);
  });

  it('leaves an unknown id alone rather than guessing', () => {
    const resolve = buildBudgetCategoryResolver(categories);
    expect(resolve({ categoryId: 'cat-nowhere' })).toBe('cat-nowhere');
  });

  it('carries a rollover into the allowance, and signs what is left', () => {
    const carried = budget({ id: 'b-roll', categoryId: 'cat-groceries', amount: 500, rollover: true, rolloverAmount: 155 });
    const transactions = [row({ id: 'g', date: new Date(2026, 9, 2), amount: -700 })];

    const [result] = evaluateBudgets([carried], { transactions, categories, now: NOW });

    expect(result.effectiveAmount.toNumber()).toBe(655);
    expect(result.remaining.toNumber()).toBe(-45);
    expect(result.percentage).toBeCloseTo(106.87, 2);
  });

  it('leaves rows in another currency out, and says how many', () => {
    const monthly = budget({ id: 'b', categoryId: 'cat-groceries' });
    const transactions = [
      row({ id: 'gbp', date: new Date(2026, 9, 2), amount: -40 }),
      row({ id: 'eur', date: new Date(2026, 9, 2), amount: -40, accountId: 'acc-eur' }),
    ];

    const [result] = evaluateBudgets([monthly], {
      transactions, categories, now: NOW, foreignAccountIds: new Set(['acc-eur']),
    });

    expect(result.spent.toNumber()).toBe(40);
    expect(result.excludedForeignCount).toBe(1);
    expect(Array.from(result.countedRowIds)).toEqual(['gbp']);
  });

  it('keeps the budgets in the order given', () => {
    const a = budget({ id: 'a', categoryId: 'cat-fuel' });
    const b = budget({ id: 'b', categoryId: 'cat-groceries' });

    expect(evaluateBudgets([b, a], { transactions: [], categories, now: NOW }).map(r => r.budget.id)).toEqual(['b', 'a']);
  });
});
