import { describe, it, expect } from 'vitest';
import { buildPayeeGroups } from './payeeGroups';
import type { Category, Transaction } from '../types';

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'cat-consumables', name: 'Consumables', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'cat-repairs', name: 'Repairs', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'type-income' },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -20,
  description: 'Boots',
  category: '',
  accountId: 'acc-a',
  type: 'expense',
  ...over,
});

describe('buildPayeeGroups', () => {
  it('groups uncategorised rows by payee and totals them', () => {
    const groups = buildPayeeGroups([
      txn({ id: '1', description: 'Boots', amount: -20 }),
      txn({ id: '2', description: 'BOOTS', amount: -35 }),   // case-insensitive
      txn({ id: '3', description: ' boots ', amount: -5 }),  // trimmed
      txn({ id: '4', description: 'Clinton Cards', amount: -8 }),
    ], CATEGORIES);

    expect(groups[0].payee).toBe('BOOTS');
    expect(groups[0].count).toBe(3);
    expect(groups[0].total).toBe(60);
    expect(groups[0].transactionIds).toEqual(['1', '2', '3']);
    expect(groups[1].payee).toBe('CLINTON CARDS');
  });

  it('separates money-in from money-out for the same payee', () => {
    const groups = buildPayeeGroups([
      txn({ id: 'spend', description: 'Amazon', amount: -50 }),
      txn({ id: 'refund', description: 'Amazon', amount: 15, type: 'income' }),
    ], CATEGORIES);

    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.direction === 'expense')?.transactionIds).toEqual(['spend']);
    expect(groups.find(g => g.direction === 'income')?.transactionIds).toEqual(['refund']);
  });

  it('suggests the MOST COMMON category the payee already uses, not the latest one-off', () => {
    const groups = buildPayeeGroups([
      // history: mostly Consumables, one recent Repairs
      txn({ id: 'h1', description: 'Amazon', amount: -10, category: 'cat-consumables', date: new Date('2026-01-01') }),
      txn({ id: 'h2', description: 'Amazon', amount: -12, category: 'cat-consumables', date: new Date('2026-02-01') }),
      txn({ id: 'h3', description: 'Amazon', amount: -90, category: 'cat-repairs', date: new Date('2026-06-01') }),
      // the uncategorised row needing a decision
      txn({ id: 'new', description: 'Amazon', amount: -30 }),
    ], CATEGORIES);

    const amazon = groups.find(g => g.payee === 'AMAZON' && g.direction === 'expense')!;
    expect(amazon.transactionIds).toEqual(['new']);
    expect(amazon.suggestedCategoryId).toBe('cat-consumables');
    expect(amazon.suggestionSupport).toBe(2);
    // 2 of 3 — support is meaningless without what it was chosen from.
    expect(amazon.suggestionSampleSize).toBe(3);
  });

  it('reports the whole sample, so a payee that disagrees with itself can be seen', () => {
    // A generic description — "ADJUSTMENT" and the like — filed every which
    // way. The most common category is a plurality of a quarter, and a screen
    // that applies a category to every row at once must be able to tell that
    // apart from a shop filed the same way every time.
    const history = [
      ...Array.from({ length: 3 }, (_, i) =>
        txn({ id: `a${i}`, description: 'Adjustment', amount: -10, category: 'cat-consumables', date: new Date('2026-01-01') })),
      ...Array.from({ length: 2 }, (_, i) =>
        txn({ id: `b${i}`, description: 'Adjustment', amount: -10, category: 'cat-repairs', date: new Date('2026-02-01') })),
      ...Array.from({ length: 2 }, (_, i) =>
        txn({ id: `c${i}`, description: 'Adjustment', amount: -10, category: 'cat-food', date: new Date('2026-03-01') })),
    ];

    const groups = buildPayeeGroups(
      [...history, txn({ id: 'new', description: 'Adjustment', amount: -5000 })],
      CATEGORIES
    );

    const group = groups.find(g => g.payee === 'ADJUSTMENT' && g.direction === 'expense')!;
    expect(group.suggestedCategoryId).toBe('cat-consumables');
    expect(group.suggestionSupport).toBe(3);
    expect(group.suggestionSampleSize).toBe(7);
    // 3/7 is a plurality, not a habit — the caller is what decides to trust it.
    expect((group.suggestionSupport ?? 0) / (group.suggestionSampleSize ?? 1)).toBeLessThan(0.8);
  });

  it('leaves the sample undefined when the payee has no history at all', () => {
    const groups = buildPayeeGroups([txn({ id: 'new', description: 'Brand New Shop', amount: -30 })], CATEGORIES);

    const group = groups.find(g => g.payee === 'BRAND NEW SHOP')!;
    expect(group.suggestedCategoryId).toBeUndefined();
    expect(group.suggestionSampleSize).toBeUndefined();
  });

  it('ties in the history break toward the most recent', () => {
    const groups = buildPayeeGroups([
      txn({ id: 'h1', description: 'Amazon', amount: -10, category: 'cat-consumables', date: new Date('2026-01-01') }),
      txn({ id: 'h2', description: 'Amazon', amount: -90, category: 'cat-repairs', date: new Date('2026-06-01') }),
      txn({ id: 'new', description: 'Amazon', amount: -30 }),
    ], CATEGORIES);

    expect(groups.find(g => g.payee === 'AMAZON')?.suggestedCategoryId).toBe('cat-repairs');
  });

  it('never groups transfers, splits, linked rows, or the bank fallback description', () => {
    const groups = buildPayeeGroups([
      txn({ id: 'transfer', description: 'Move', type: 'transfer' }),
      txn({ id: 'split', description: 'Shop', isSplit: true }),
      txn({ id: 'linked', description: 'Pair', linkedTransferId: 'x' }),
      txn({ id: 'fallback', description: 'Bank transaction' }),
      txn({ id: 'blank', description: '   ' }),
      txn({ id: 'real', description: 'Boots' }),
    ], CATEGORIES);

    expect(groups).toHaveLength(1);
    expect(groups[0].transactionIds).toEqual(['real']);
  });

  it('rows with a real category are history, never groups to decide', () => {
    const groups = buildPayeeGroups([
      txn({ id: 'done', description: 'Boots', category: 'cat-consumables' }),
    ], CATEGORIES);
    expect(groups).toHaveLength(0);
  });

  it('treats a dangling category id as uncategorised', () => {
    const groups = buildPayeeGroups([
      txn({ id: 'orphan', description: 'Boots', category: 'category-that-was-deleted' }),
    ], CATEGORIES);
    expect(groups).toHaveLength(1);
    expect(groups[0].transactionIds).toEqual(['orphan']);
  });

  it('orders by row count so the biggest wins come first', () => {
    const groups = buildPayeeGroups([
      txn({ id: 'a1', description: 'Rare', amount: -1000 }),
      txn({ id: 'b1', description: 'Common', amount: -1 }),
      txn({ id: 'b2', description: 'Common', amount: -1 }),
    ], CATEGORIES);
    expect(groups[0].payee).toBe('COMMON');
  });

  it('records span: dates and accounts covered', () => {
    const groups = buildPayeeGroups([
      txn({ id: '1', description: 'Boots', date: new Date('2026-03-01'), accountId: 'acc-a' }),
      txn({ id: '2', description: 'Boots', date: new Date('2026-07-01'), accountId: 'acc-b' }),
    ], CATEGORIES);
    expect(groups[0].earliest).toEqual(new Date('2026-03-01'));
    expect(groups[0].latest).toEqual(new Date('2026-07-01'));
    expect(groups[0].accountIds).toEqual(['acc-a', 'acc-b']);
  });
});

describe('buildPayeeGroups — last-used alongside the habit', () => {
  const CATS: Category[] = [
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
    { id: 'cat-consumables', name: 'Consumables', type: 'expense', level: 'detail', parentId: 'type-expense' },
    { id: 'cat-repairs', name: 'Repairs', type: 'expense', level: 'detail', parentId: 'type-expense' },
  ];
  const t = (over: Partial<Transaction> & { id: string }): Transaction => ({
    date: new Date('2026-07-10'), amount: -20, description: 'Amazon', category: '',
    accountId: 'acc-a', type: 'expense', ...over,
  });

  it('exposes the most RECENT category when it differs from the habit', () => {
    const [group] = buildPayeeGroups([
      t({ id: 'h1', category: 'cat-consumables', date: new Date('2026-01-01') }),
      t({ id: 'h2', category: 'cat-consumables', date: new Date('2026-02-01') }),
      t({ id: 'h3', category: 'cat-repairs', date: new Date('2026-06-01') }),
      t({ id: 'new' }),
    ], CATS);

    expect(group.suggestedCategoryId).toBe('cat-consumables'); // the habit
    expect(group.lastUsedCategoryId).toBe('cat-repairs');      // one click away
  });

  it('omits last-used when it IS the habit (nothing to offer)', () => {
    const [group] = buildPayeeGroups([
      t({ id: 'h1', category: 'cat-consumables', date: new Date('2026-01-01') }),
      t({ id: 'h2', category: 'cat-consumables', date: new Date('2026-06-01') }),
      t({ id: 'new' }),
    ], CATS);

    expect(group.suggestedCategoryId).toBe('cat-consumables');
    expect(group.lastUsedCategoryId).toBeUndefined();
  });
});
