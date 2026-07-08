import { describe, it, expect } from 'vitest';
import { computeExpenseCategoryNetTotals } from '../categoryNetting';
import type { Transaction, Category } from '../../types';

const categories: Category[] = [
  { id: 'cat-petrol', name: 'Petrol / Diesel', type: 'expense', level: 'detail', parentId: 'sub-cars' },
  { id: 'cat-netpay', name: 'Net Pay', type: 'income', level: 'detail', parentId: 'sub-wages' },
  { id: 'cat-adjust', name: 'Account Adjustments', type: 'both', level: 'detail', parentId: 'sub-adj' },
];

const txn = (overrides: Partial<Transaction>): Transaction => ({
  id: `tx-${Math.abs(overrides.amount ?? 0)}-${overrides.category ?? 'none'}-${overrides.type}`,
  date: new Date('2026-01-01'),
  amount: -10,
  description: 'x',
  category: '',
  accountId: 'acc-1',
  type: 'expense',
  cleared: false,
  ...overrides,
});

describe('computeExpenseCategoryNetTotals', () => {
  it('nets a refund against its expense category (the Microsoft Money model)', () => {
    const totals = computeExpenseCategoryNetTotals([
      txn({ type: 'expense', category: 'cat-petrol', amount: -100 }),
      // Refund: income by direction, filed under the expense category.
      txn({ type: 'income', category: 'cat-petrol', amount: 50 }),
    ], categories);

    expect(totals).toEqual([{ key: 'cat-petrol', name: 'Petrol / Diesel', value: 50 }]);
  });

  it('resolves category NAMES for chart labels, never raw ids', () => {
    const totals = computeExpenseCategoryNetTotals([
      txn({ type: 'expense', category: 'cat-petrol', amount: -25 }),
    ], categories);
    expect(totals[0].name).toBe('Petrol / Diesel');
  });

  it('excludes expenses filed under an INCOME category from the expense breakdown', () => {
    // An outgoing categorised as income (e.g. returned wages) nets the income
    // side instead — it must not appear as spending.
    const totals = computeExpenseCategoryNetTotals([
      txn({ type: 'expense', category: 'cat-netpay', amount: -75 }),
    ], categories);
    expect(totals).toEqual([]);
  });

  it("buckets 'both'-typed and uncategorized rows by transaction direction", () => {
    const totals = computeExpenseCategoryNetTotals([
      txn({ type: 'expense', category: 'cat-adjust', amount: -20 }),
      txn({ type: 'income', category: 'cat-adjust', amount: 5 }),   // income side — excluded
      txn({ type: 'expense', category: '', amount: -30 }),
    ], categories);

    expect(totals).toEqual([
      { key: 'uncategorized', name: 'Uncategorized', value: 30 },
      { key: 'cat-adjust', name: 'Account Adjustments', value: 20 },
    ]);
  });

  it('omits categories whose refunds meet or exceed spending', () => {
    const totals = computeExpenseCategoryNetTotals([
      txn({ type: 'expense', category: 'cat-petrol', amount: -40 }),
      txn({ type: 'income', category: 'cat-petrol', amount: 40 }),
    ], categories);
    expect(totals).toEqual([]);
  });

  it('never counts transfers as spending', () => {
    const totals = computeExpenseCategoryNetTotals([
      txn({ type: 'transfer', category: 'transfer-out', amount: -500 }),
    ], categories);
    expect(totals).toEqual([]);
  });
});
