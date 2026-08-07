import { describe, expect, it } from 'vitest';

import {
  TEST_DATA_COUNTS,
  TEST_DATA_TRANSACTION_COUNT,
  buildTestDataset,
  planTestDataCategories,
  type TestDatasetCategory
} from './testDataset';
import { demoAccounts } from './demoData';
import { getDefaultCategories } from '../data/defaultCategories';
import { toDecimal } from './decimal';
import type { Category } from '../types';

/** The default set, typed as the context holds it. */
const defaultCategories = (): Category[] =>
  getDefaultCategories().map(category => ({
    id: category.id,
    name: category.name,
    type: category.type,
    level: category.level,
    parentId: category.parentId,
    isSystem: category.isSystem
  }));

describe('buildTestDataset', () => {
  it('carries no ids at all, so nothing can collide with a login that already has rows', () => {
    const dataset = buildTestDataset(20);

    for (const account of dataset.accounts) {
      expect(Object.keys(account)).not.toContain('id');
    }
    for (const transaction of dataset.transactions) {
      expect(Object.keys(transaction)).not.toContain('id');
      // References travel as a join key and a NAME, never as a foreign id.
      expect(typeof transaction.accountKey).toBe('string');
      expect(typeof transaction.categoryName).toBe('string');
    }
    for (const budget of dataset.budgets) {
      expect(Object.keys(budget)).not.toContain('id');
      expect(Object.keys(budget)).not.toContain('categoryId');
    }
    for (const goal of dataset.goals) {
      expect(Object.keys(goal)).not.toContain('id');
    }
  });

  it('gives every load a different shape, so two loads are two independent sets', () => {
    const first = buildTestDataset(40);
    const second = buildTestDataset(40);

    // Not an id check (there are no ids) — the point is that the builder is not
    // a frozen constant being handed out twice.
    const describe1 = first.transactions.map(t => `${t.date.toISOString()}|${t.amount}`).join();
    const describe2 = second.transactions.map(t => `${t.date.toISOString()}|${t.amount}`).join();
    expect(describe1).not.toEqual(describe2);
  });

  it('opens each account at the balance that makes its transactions add up to the headline figure', () => {
    const dataset = buildTestDataset(80);

    for (const account of dataset.accounts) {
      const movement = dataset.transactions
        .filter(t => t.accountKey === account.key)
        .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

      const closing = toDecimal(account.openingBalance).plus(movement).toDecimalPlaces(2);
      expect(closing.toNumber()).toBe(account.expectedBalance);
    }
  });

  it('keeps the sample accounts and their headline balances', () => {
    const dataset = buildTestDataset(10);

    expect(dataset.accounts).toHaveLength(demoAccounts.length);
    expect(dataset.accounts.map(a => a.name)).toEqual(demoAccounts.map(a => a.name));
    expect(dataset.accounts.map(a => a.expectedBalance)).toEqual(
      demoAccounts.map(a => toDecimal(a.balance).toDecimalPlaces(2).toNumber())
    );
    // 'checking' is the database spelling; the app says 'current'.
    expect(dataset.accounts[0].type).toBe('current');
  });

  it('creates exactly the number of transactions asked for', () => {
    expect(buildTestDataset(7).transactions).toHaveLength(7);
    expect(buildTestDataset().transactions).toHaveLength(TEST_DATA_TRANSACTION_COUNT);
  });

  it('agrees with the counts the confirmation dialog quotes', () => {
    const dataset = buildTestDataset();

    expect(dataset.accounts).toHaveLength(TEST_DATA_COUNTS.accounts);
    expect(dataset.transactions).toHaveLength(TEST_DATA_COUNTS.transactions);
    expect(dataset.budgets).toHaveLength(TEST_DATA_COUNTS.budgets);
    expect(dataset.goals).toHaveLength(TEST_DATA_COUNTS.goals);
  });

  it('reads each transaction type off its own sign', () => {
    for (const transaction of buildTestDataset(60).transactions) {
      expect(transaction.type).toBe(transaction.amount < 0 ? 'expense' : 'income');
    }
  });

  it('lists every category its rows reference, parents before children', () => {
    const dataset = buildTestDataset(80);
    const listed = new Set(dataset.categories.map(c => c.name.toLowerCase()));

    for (const transaction of dataset.transactions) {
      expect(listed.has(transaction.categoryName.toLowerCase())).toBe(true);
    }
    for (const budget of dataset.budgets) {
      expect(listed.has(budget.categoryName.toLowerCase())).toBe(true);
    }

    const seen = new Set<string>();
    for (const category of dataset.categories) {
      if (category.parentName) {
        expect(seen.has(category.parentName.toLowerCase())).toBe(true);
      }
      seen.add(category.name.toLowerCase());
    }
  });

  it('hands over real Dates, not the wire strings the sample stores', () => {
    const dataset = buildTestDataset(15);

    for (const transaction of dataset.transactions) {
      expect(transaction.date).toBeInstanceOf(Date);
      expect(Number.isNaN(transaction.date.getTime())).toBe(false);
    }
    for (const goal of dataset.goals) {
      expect(goal.targetDate).toBeInstanceOf(Date);
      expect(Number.isNaN(goal.targetDate.getTime())).toBe(false);
    }
  });
});

describe('planTestDataCategories', () => {
  const groceries: TestDatasetCategory = {
    name: 'Groceries', type: 'expense', level: 'sub', parentName: 'Expense'
  };
  const expenseAnchor: TestDatasetCategory = { name: 'Expense', type: 'expense', level: 'type' };
  const foodDrink: TestDatasetCategory = {
    name: 'Food & Drink', type: 'expense', level: 'detail', parentName: 'Groceries'
  };

  it('reuses a category the login already has, matched by name not by id', () => {
    const existing: Category[] = [
      { id: 'uuid-for-groceries', name: 'Groceries', type: 'expense', level: 'sub' }
    ];

    const plan = planTestDataCategories([groceries], existing);

    expect(plan.toCreate).toHaveLength(0);
    expect(plan.resolved.get('groceries')).toBe('uuid-for-groceries');
  });

  it('matches case-insensitively', () => {
    const existing: Category[] = [
      { id: 'uuid-1', name: 'GROCERIES', type: 'expense', level: 'sub' }
    ];

    expect(planTestDataCategories([groceries], existing).resolved.get('groceries')).toBe('uuid-1');
  });

  it('prefers the same level when one name exists at two of them', () => {
    const existing: Category[] = [
      { id: 'anchor', name: 'Investments', type: 'both', level: 'type' },
      { id: 'sub', name: 'Investments', type: 'both', level: 'sub' }
    ];

    const plan = planTestDataCategories(
      [{ name: 'Investments', type: 'both', level: 'sub' }],
      existing
    );

    expect(plan.resolved.get('investments')).toBe('sub');
  });

  it('creates a missing category under the parent the login already has', () => {
    const existing: Category[] = [
      { id: 'type-expense-uuid', name: 'Expense', type: 'expense', level: 'type' }
    ];

    const plan = planTestDataCategories([expenseAnchor, groceries], existing);

    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0].key).toBe('groceries');
    expect(plan.toCreate[0].category.parentId).toBe('type-expense-uuid');
    expect(plan.toCreate[0].parentKey).toBeUndefined();
  });

  it('plans the type anchors too when the login has NO categories at all', () => {
    const plan = planTestDataCategories([expenseAnchor, groceries, foodDrink], []);

    expect(plan.resolved.size).toBe(0);
    expect(plan.toCreate.map(p => p.key)).toEqual(['expense', 'groceries', 'food & drink']);
    // Parents first, each child pointing at the one planned before it.
    expect(plan.toCreate[0].parentKey).toBeUndefined();
    expect(plan.toCreate[1].parentKey).toBe('expense');
    expect(plan.toCreate[2].parentKey).toBe('groceries');
    // No id is invented for a parent that has not been written yet.
    expect(plan.toCreate[1].category.parentId).toBeUndefined();
  });

  it('keeps the level the sample asked for', () => {
    const plan = planTestDataCategories([expenseAnchor, groceries, foodDrink], []);

    expect(plan.toCreate.map(p => p.category.level)).toEqual(['type', 'sub', 'detail']);
  });

  it('never plans the same name twice', () => {
    const plan = planTestDataCategories([groceries, groceries, groceries], []);

    expect(plan.toCreate.filter(p => p.key === 'groceries')).toHaveLength(1);
  });

  /**
   * The two checks that matter for any plan: nothing is left uncovered, and
   * walking the plan in order never needs an id that has not been minted yet.
   */
  const expectPlanIsComplete = (
    dataset: ReturnType<typeof buildTestDataset>,
    plan: ReturnType<typeof planTestDataCategories>
  ): void => {
    for (const category of dataset.categories) {
      const key = category.name.toLowerCase();
      // A category that is neither found nor created is a transaction filed
      // under nothing.
      expect(plan.resolved.has(key) || plan.toCreate.some(p => p.key === key)).toBe(true);
    }

    const available = new Set(plan.resolved.keys());
    for (const planned of plan.toCreate) {
      if (planned.parentKey) expect(available.has(planned.parentKey)).toBe(true);
      // A parent that already existed is pointed at by its real id instead.
      if (!planned.parentKey && planned.category.level !== 'type') {
        expect(planned.category.parentId === undefined || typeof planned.category.parentId === 'string').toBe(true);
      }
      available.add(planned.key);
    }
  };

  it('resolves or plans every category the real dataset needs, against the default set', () => {
    const dataset = buildTestDataset(200);
    const plan = planTestDataCategories(dataset.categories, defaultCategories());

    expectPlanIsComplete(dataset, plan);
    // The default set has the type anchors and a few of the sample's names, so
    // those are reused rather than duplicated.
    expect(plan.resolved.get('expense')).toBe('type-expense');
    expect(plan.resolved.get('income')).toBe('type-income');
    expect(plan.resolved.has('healthcare')).toBe(true);
    expect(plan.toCreate.some(p => p.key === 'healthcare')).toBe(false);
  });

  it('covers the real dataset from a completely empty login as well', () => {
    const dataset = buildTestDataset(200);
    const plan = planTestDataCategories(dataset.categories, []);

    expect(plan.resolved.size).toBe(0);
    expect(plan.toCreate).toHaveLength(dataset.categories.length);
    expectPlanIsComplete(dataset, plan);
    // Including the anchors, which a cleared login no longer has.
    expect(plan.toCreate.filter(p => p.category.level === 'type').map(p => p.category.name).sort())
      .toEqual(['Expense', 'Income']);
  });
});
