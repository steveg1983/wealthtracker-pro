import { describe, it, expect } from 'vitest';
import { compareTransactions, transactionSortValue } from './transactionSort';
import type { Transaction, Category } from '../types';

const cats: Category[] = [
  { id: 'c-food', name: 'Food', type: 'expense', level: 'detail' },
  { id: 'c-salary', name: 'Salary', type: 'income', level: 'detail' }
];

const t = (over: Partial<Transaction>): Transaction => ({
  id: 'x',
  date: new Date('2024-01-15'),
  description: 'x',
  amount: -10,
  type: 'expense',
  accountId: 'a',
  category: '',
  cleared: false,
  ...over
}) as Transaction;

const orderedIds = (
  txns: Transaction[],
  field: Parameters<typeof compareTransactions>[2],
  dir: 'asc' | 'desc'
) => [...txns].sort((a, b) => compareTransactions(a, b, field, dir, cats)).map(x => x.id);

describe('compareTransactions', () => {
  it('orders by signed amount for amount / payment / deposit', () => {
    const list = [t({ id: 'a', amount: -50 }), t({ id: 'b', amount: 200 }), t({ id: 'c', amount: -10 })];
    expect(orderedIds(list, 'amount', 'asc')).toEqual(['a', 'c', 'b']); // -50, -10, 200
    expect(orderedIds(list, 'payment', 'asc')).toEqual(['a', 'c', 'b']);
    expect(orderedIds(list, 'deposit', 'desc')).toEqual(['b', 'c', 'a']); // 200, -10, -50
  });

  it('orders by resolved category name (case-insensitive; uncategorised first)', () => {
    const list = [
      t({ id: 's', category: 'c-salary' }),
      t({ id: 'f', category: 'c-food' }),
      t({ id: 'u', category: '' })
    ];
    expect(orderedIds(list, 'category', 'asc')).toEqual(['u', 'f', 's']); // '', food, salary
  });

  it('orders by description case-insensitively', () => {
    const list = [
      t({ id: 'z', description: 'zebra' }),
      t({ id: 'a', description: 'Apple' }),
      t({ id: 'm', description: 'mango' })
    ];
    expect(orderedIds(list, 'description', 'asc')).toEqual(['a', 'm', 'z']);
  });

  it('orders by tags', () => {
    const list = [t({ id: 'b', tags: ['work'] }), t({ id: 'a', tags: ['bills'] }), t({ id: 'n', tags: [] })];
    expect(orderedIds(list, 'tags', 'asc')).toEqual(['n', 'a', 'b']); // '', bills, work
  });

  it('orders by date chronologically, tie-broken by type (income→transfer→expense)', () => {
    const list = [
      t({ id: 'exp', date: new Date('2024-03-01'), type: 'expense' }),
      t({ id: 'inc', date: new Date('2024-03-01'), type: 'income' }),
      t({ id: 'old', date: new Date('2024-01-01'), type: 'expense' })
    ];
    expect(orderedIds(list, 'date', 'asc')).toEqual(['old', 'inc', 'exp']);
    // desc flips the day order but keeps the same-day income-before-expense tiebreak
    expect(orderedIds(list, 'date', 'desc')).toEqual(['inc', 'exp', 'old']);
  });

  it('exposes the comparable value via transactionSortValue', () => {
    expect(transactionSortValue(t({ amount: -5 }), 'payment', cats)).toBe(-5);
    expect(transactionSortValue(t({ category: 'c-food' }), 'category', cats)).toBe('food');
  });
});
