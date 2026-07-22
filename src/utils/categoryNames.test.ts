import { describe, it, expect } from 'vitest';
import { buildCategoryNameLookup } from './categoryNames';
import type { Category } from '../types';

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food Related Costs', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

describe('buildCategoryNameLookup', () => {
  const name = buildCategoryNameLookup(CATEGORIES);

  it('qualifies a detail category with its parent', () => {
    expect(name('cat-groceries')).toBe('Food Related Costs : Groceries');
  });

  it('never prefixes the top-level type node', () => {
    expect(name('grp-food')).toBe('Food Related Costs');
  });

  it('never leaks a raw id for a missing or dangling category', () => {
    expect(name('1bcb1126-66e4-48e5-960e-251f917172bd')).toBe('Uncategorised');
    expect(name('')).toBe('Uncategorised');
    expect(name(undefined)).toBe('Uncategorised');
    expect(name(null)).toBe('Uncategorised');
  });
});
