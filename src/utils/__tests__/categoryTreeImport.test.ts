import { describe, it, expect } from 'vitest';
import { planCategoryTreeImport, type CategoryTreeGroup } from '../categoryTreeImport';
import { MS_MONEY_CATEGORY_SET } from '../../data/msMoneyCategories';
import type { Category } from '../../types';

const typeCategories: Category[] = [
  { id: 'uuid-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'uuid-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'uuid-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
];

describe('planCategoryTreeImport', () => {
  it('creates every sub and detail against a bare category set', () => {
    const tree: CategoryTreeGroup[] = [
      { name: 'Cars & Bikes', type: 'expense', children: ['Petrol / Diesel', 'Road Tax'] },
      { name: 'Wages & Salary', type: 'income', children: ['Net Pay'] },
    ];

    const plan = planCategoryTreeImport(typeCategories, tree);

    expect(plan.subsToCreate).toHaveLength(2);
    expect(plan.subsToCreate[0]).toMatchObject({
      name: 'Cars & Bikes',
      type: 'expense',
      level: 'sub',
      parentId: 'uuid-expense',
    });
    expect(plan.detailsToCreate).toHaveLength(3);
    expect(plan.detailsToCreate[0]).toMatchObject({
      subName: 'Cars & Bikes',
      type: 'expense',
      category: { name: 'Petrol / Diesel', level: 'detail', type: 'expense' },
    });
    expect(plan.skippedCount).toBe(0);
    expect(plan.totalCount).toBe(5);
  });

  it('skips same-named subs and details case-insensitively (idempotent re-import)', () => {
    const existing: Category[] = [
      ...typeCategories,
      { id: 'sub-1', name: 'cars & bikes', type: 'expense', level: 'sub', parentId: 'uuid-expense' },
      { id: 'det-1', name: 'PETROL / DIESEL', type: 'expense', level: 'detail', parentId: 'sub-1' },
    ];
    const tree: CategoryTreeGroup[] = [
      { name: 'Cars & Bikes', type: 'expense', children: ['Petrol / Diesel', 'Road Tax'] },
    ];

    const plan = planCategoryTreeImport(existing, tree);

    expect(plan.subsToCreate).toHaveLength(0);
    expect(plan.detailsToCreate).toHaveLength(1);
    expect(plan.detailsToCreate[0].category.name).toBe('Road Tax');
    expect(plan.skippedCount).toBe(2); // the sub + the existing detail
  });

  it('merges new details into an existing default sub instead of duplicating it', () => {
    const existing: Category[] = [
      ...typeCategories,
      { id: 'sub-inv', name: 'Investment Income', type: 'income', level: 'sub', parentId: 'uuid-income', isSystem: true },
      { id: 'det-div', name: 'Dividends', type: 'income', level: 'detail', parentId: 'sub-inv' },
    ];
    const tree: CategoryTreeGroup[] = [
      { name: 'Investment Income', type: 'income', children: ['Bank Interest', 'Dividends'] },
    ];

    const plan = planCategoryTreeImport(existing, tree);

    expect(plan.subsToCreate).toHaveLength(0);
    expect(plan.detailsToCreate.map(d => d.category.name)).toEqual(['Bank Interest']);
  });

  it('gives an empty group a single self-named detail so it stays selectable', () => {
    const tree: CategoryTreeGroup[] = [
      { name: 'Xfer to Deleted Account', type: 'expense', children: [] },
    ];

    const plan = planCategoryTreeImport(typeCategories, tree);

    expect(plan.detailsToCreate).toHaveLength(1);
    expect(plan.detailsToCreate[0].category.name).toBe('Xfer to Deleted Account');
  });

  it("dedupes against a 'both'-typed sub under the anchor (type is not part of the match)", () => {
    // A cross-section drag historically minted subs typed 'both' under a real
    // anchor. The planner treats them as existing; the context resolver must
    // therefore index subs by ANCHOR (not by their own type) or details would
    // have no parent to attach to.
    const existing: Category[] = [
      ...typeCategories,
      { id: 'sub-h', name: 'Healthcare', type: 'both', level: 'sub', parentId: 'uuid-expense' },
    ];
    const tree: CategoryTreeGroup[] = [
      { name: 'Healthcare', type: 'expense', children: ['Dental'] },
    ];

    const plan = planCategoryTreeImport(existing, tree);
    expect(plan.subsToCreate).toHaveLength(0);
    expect(plan.detailsToCreate.map(d => d.category.name)).toEqual(['Dental']);
  });

  it('does not match a same-named sub under the wrong type anchor', () => {
    const existing: Category[] = [
      ...typeCategories,
      // "Other Income" name but parked under EXPENSE — must not be treated as a match.
      { id: 'sub-x', name: 'Other Income', type: 'expense', level: 'sub', parentId: 'uuid-expense' },
    ];
    const tree: CategoryTreeGroup[] = [
      { name: 'Other Income', type: 'income', children: ['Child Benefit'] },
    ];

    const plan = planCategoryTreeImport(existing, tree);
    expect(plan.subsToCreate).toHaveLength(1);
    expect(plan.subsToCreate[0].parentId).toBe('uuid-income');
  });

  it('throws when the type anchors are missing (categories not loaded)', () => {
    expect(() => planCategoryTreeImport([], [{ name: 'X', type: 'expense', children: [] }]))
      .toThrow(/type categories are not loaded/);
  });

  it('plans the full Microsoft Money set cleanly against a bare tree', () => {
    const plan = planCategoryTreeImport(typeCategories, MS_MONEY_CATEGORY_SET);

    // 16 groups: 12 expense + 4 income.
    expect(plan.subsToCreate).toHaveLength(16);
    // Every detail resolves to a group in the set, and empty groups self-fill.
    const subNames = new Set(plan.subsToCreate.map(s => s.name));
    plan.detailsToCreate.forEach(d => expect(subNames.has(d.subName)).toBe(true));
    expect(plan.detailsToCreate.map(d => d.category.name)).toContain('Xfer to Deleted Account');
    expect(plan.skippedCount).toBe(0);
    // 16 subs + 86 details (84 named children + 2 self-named for empty groups).
    expect(plan.totalCount).toBe(16 + 86);
    expect(plan.detailsToCreate).toHaveLength(86);
  });
});
