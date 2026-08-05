import { describe, it, expect } from 'vitest';
import {
  buildCategoryChildIndex,
  calculateBudgetSpend,
  collectBudgetCategoryIds,
  foreignCurrencyAccountIds,
  prepareBudgetTransactions
} from './budgetSpending';
import type { Account, Budget, Transaction, TransactionSplit } from '../types';

const NOW = new Date(2026, 7, 15, 12, 0, 0);

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date(2026, 7, 10),
  amount: -10,
  description: 'synthetic row',
  category: 'det-groceries',
  accountId: 'acc-gbp',
  type: 'expense',
  ...over
});

const budget = (over: Partial<Budget> = {}): Budget => ({
  id: 'bud-1',
  categoryId: 'det-groceries',
  amount: 200,
  period: 'monthly',
  isActive: true,
  spent: 0,
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 0, 1),
  ...over
});

describe('prepareBudgetTransactions', () => {
  it('replaces a split parent with its lines, so each line spends against its own category', () => {
    const parent = txn({ id: 't-split', amount: -100, isSplit: true });
    const splits: TransactionSplit[] = [
      { id: 's1', transactionId: 't-split', category: 'det-groceries', amount: -70, sortOrder: 0 },
      { id: 's2', transactionId: 't-split', category: 'det-household', amount: -30, sortOrder: 1 }
    ];

    const prepared = prepareBudgetTransactions([parent], splits);

    expect(prepared).toHaveLength(2);
    expect(prepared.map(row => row.category)).toEqual(['det-groceries', 'det-household']);
    expect(prepared.map(row => row.amount.toNumber())).toEqual([-70, -30]);
  });

  it('passes plain rows through, decimalised', () => {
    const prepared = prepareBudgetTransactions([txn({ id: 't1', amount: -12.34 })], []);
    expect(prepared[0].amount.toString()).toBe('-12.34');
  });
});

describe('calculateBudgetSpend', () => {
  it('counts a split line against the budget for ITS category', () => {
    const parent = txn({ id: 't-split', amount: -100, isSplit: true, category: 'det-household' });
    const splits: TransactionSplit[] = [
      { id: 's1', transactionId: 't-split', category: 'det-groceries', amount: -70, sortOrder: 0 },
      { id: 's2', transactionId: 't-split', category: 'det-household', amount: -30, sortOrder: 1 }
    ];
    const prepared = prepareBudgetTransactions([parent], splits);

    const { spent } = calculateBudgetSpend(budget(), prepared, { now: NOW });

    expect(spent.toString()).toBe('70');
  });

  it('nets a refund filed under the budget category off the spend', () => {
    const prepared = prepareBudgetTransactions(
      [
        txn({ id: 't1', amount: -100 }),
        txn({ id: 't2', amount: 30, type: 'income', date: new Date(2026, 7, 12) })
      ],
      []
    );

    expect(calculateBudgetSpend(budget(), prepared, { now: NOW }).spent.toString()).toBe('70');
  });

  it('measures a weekly budget over the week, not the year', () => {
    const prepared = prepareBudgetTransactions(
      [
        txn({ id: 't-this-week', amount: -25, date: new Date(2026, 7, 12) }),
        txn({ id: 't-last-month', amount: -500, date: new Date(2026, 6, 12) })
      ],
      []
    );

    const { spent, window } = calculateBudgetSpend(budget({ period: 'weekly' }), prepared, { now: NOW });

    expect(spent.toString()).toBe('25');
    expect(window.label).toBe('Weekly');
  });

  it('rolls a group budget up over its descendant categories', () => {
    const categories = [
      { id: 'type-expense', parentId: null },
      { id: 'grp-food', parentId: 'type-expense' },
      { id: 'det-groceries', parentId: 'grp-food' },
      { id: 'det-takeaway', parentId: 'grp-food' },
      { id: 'grp-home', parentId: 'type-expense' },
      { id: 'det-household', parentId: 'grp-home' }
    ];
    const index = buildCategoryChildIndex(categories);
    const categoryIds = collectBudgetCategoryIds('grp-food', index);

    const prepared = prepareBudgetTransactions(
      [
        txn({ id: 't1', amount: -40, category: 'det-groceries' }),
        txn({ id: 't2', amount: -15, category: 'det-takeaway' }),
        txn({ id: 't3', amount: -60, category: 'det-household' })
      ],
      []
    );

    const { spent } = calculateBudgetSpend(budget({ categoryId: 'grp-food' }), prepared, {
      now: NOW,
      categoryIds
    });

    expect(spent.toString()).toBe('55');
  });

  it('leaves a detail budget matching only itself', () => {
    const index = buildCategoryChildIndex([{ id: 'det-groceries', parentId: 'grp-food' }]);
    const categoryIds = collectBudgetCategoryIds('det-groceries', index);

    expect([...categoryIds]).toEqual(['det-groceries']);
  });

  it('leaves out rows on accounts in another currency, and says how many', () => {
    const accounts: Account[] = [
      { id: 'acc-gbp', name: 'Synthetic Current', type: 'current', balance: 0, currency: 'GBP', lastUpdated: NOW },
      { id: 'acc-eur', name: 'Synthetic Euro', type: 'current', balance: 0, currency: 'EUR', lastUpdated: NOW }
    ];
    const foreignAccountIds = foreignCurrencyAccountIds(accounts, 'GBP');

    const prepared = prepareBudgetTransactions(
      [
        txn({ id: 't1', amount: -40 }),
        txn({ id: 't2', amount: -25, accountId: 'acc-eur' })
      ],
      []
    );

    const { spent, excludedForeignCount } = calculateBudgetSpend(budget(), prepared, {
      now: NOW,
      foreignAccountIds
    });

    expect(spent.toString()).toBe('40');
    expect(excludedForeignCount).toBe(1);
  });

  it('treats an account with no currency recorded as being in the display currency', () => {
    const accounts: Account[] = [
      { id: 'acc-gbp', name: 'Synthetic Current', type: 'current', balance: 0, currency: '', lastUpdated: NOW }
    ];

    expect(foreignCurrencyAccountIds(accounts, 'GBP').size).toBe(0);
  });

  it('survives a cycle in stored parent links instead of hanging', () => {
    const index = buildCategoryChildIndex([
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' }
    ]);

    expect([...collectBudgetCategoryIds('a', index)].sort()).toEqual(['a', 'b']);
  });
});
