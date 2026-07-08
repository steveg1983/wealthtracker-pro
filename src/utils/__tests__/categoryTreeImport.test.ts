import { describe, it, expect } from 'vitest';
import { planCategoryTreeImport, planCategoryPrune, type CategoryTreeGroup } from '../categoryTreeImport';
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

describe('planCategoryPrune', () => {
  const tree: CategoryTreeGroup[] = [
    { name: 'Cars & Bikes', type: 'expense', children: ['Petrol / Diesel'] },
    { name: 'Wages & Salary', type: 'income', children: ['Net Pay'] },
  ];

  const base: Category[] = [
    ...typeCategories,
    // In the tree — kept.
    { id: 'sub-cars', name: 'Cars & Bikes', type: 'expense', level: 'sub', parentId: 'uuid-expense' },
    { id: 'det-petrol', name: 'Petrol / Diesel', type: 'expense', level: 'detail', parentId: 'sub-cars' },
    // Default set leftovers — prunable when unused.
    { id: 'sub-shopping', name: 'Shopping', type: 'expense', level: 'sub', parentId: 'uuid-expense' },
    { id: 'det-clothing', name: 'Clothing', type: 'expense', level: 'detail', parentId: 'sub-shopping' },
    // System / transfer — never pruned.
    { id: 'sub-adj', name: 'Adjustments', type: 'both', level: 'sub', parentId: 'uuid-expense', isSystem: true },
    { id: 'det-tocat', name: 'To/From Bank', type: 'both', level: 'detail', parentId: 'uuid-transfer', isTransferCategory: true, accountId: 'acc-1' },
  ];

  it('prunes unused non-tree categories and keeps tree/system/transfer ones', () => {
    const plan = planCategoryPrune(base, tree, new Set());
    expect(plan.detailIdsToDelete).toEqual(['det-clothing']);
    expect(plan.subIdsToDelete).toEqual(['sub-shopping']);
    expect(plan.keptForTransactionsCount).toBe(0);
  });

  it('keeps categories that transactions still reference (and their parent sub)', () => {
    const plan = planCategoryPrune(base, tree, new Set(['det-clothing']));
    expect(plan.detailIdsToDelete).toEqual([]);
    expect(plan.subIdsToDelete).toEqual([]);
    expect(plan.keptForTransactionsCount).toBe(1);
  });

  it('prunes non-tree details inside a tree sub without touching the sub', () => {
    const existing: Category[] = [
      ...base,
      // A default detail living under the KEPT tree sub.
      { id: 'det-legacy', name: 'Old Detail', type: 'expense', level: 'detail', parentId: 'sub-cars' },
    ];
    const plan = planCategoryPrune(existing, tree, new Set());
    expect(plan.detailIdsToDelete).toContain('det-legacy');
    expect(plan.subIdsToDelete).not.toContain('sub-cars');
  });

  it('prunes legacy defaults even though the old seed stamped them isSystem', () => {
    // The pre-Money default seed marked ordinary subs (Housing, Transport…)
    // as isSystem — the flag must not smuggle them (or their details) past
    // the replace semantics for existing users.
    const existing: Category[] = [
      ...typeCategories,
      { id: 'sub-housing', name: 'Housing', type: 'expense', level: 'sub', parentId: 'uuid-expense', isSystem: true },
      { id: 'det-rent', name: 'Rent', type: 'expense', level: 'detail', parentId: 'sub-housing' },
    ];
    const plan = planCategoryPrune(existing, tree, new Set());
    expect(plan.detailIdsToDelete).toContain('det-rent');
    expect(plan.subIdsToDelete).toContain('sub-housing');
  });

  it('always protects the Adjustments bucket and transfer categories by identity', () => {
    const existing: Category[] = [
      ...typeCategories,
      { id: 'sub-adj2', name: 'Adjustments', type: 'both', level: 'sub', parentId: 'uuid-expense' },
      { id: 'det-adj2', name: 'Account Adjustments', type: 'both', level: 'detail', parentId: 'sub-adj2' },
    ];
    const plan = planCategoryPrune(existing, tree, new Set());
    expect(plan.detailIdsToDelete).toEqual([]);
    expect(plan.subIdsToDelete).toEqual([]);
  });
});
