import { describe, it, expect } from 'vitest';
import { buildCategoryMatcher } from './qifCategoryMatch';
import type { Category } from '../types';

const cats: Category[] = [
  { id: 'sub-bills', name: 'Bills', type: 'expense', level: 'sub' },
  { id: 'det-electric', name: 'Electric', type: 'expense', level: 'detail', parentId: 'sub-bills' },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: 'sub-income', name: 'Income', type: 'income', level: 'sub' },
  { id: 'det-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'sub-income' },
  // "Other" exists under two parents / two directions — tests disambiguation.
  { id: 'det-other-exp', name: 'Other', type: 'expense', level: 'detail', parentId: 'sub-bills' },
  { id: 'det-other-inc', name: 'Other', type: 'income', level: 'detail', parentId: 'sub-income' }
];

describe('buildCategoryMatcher', () => {
  const { match } = buildCategoryMatcher(cats);

  it('matches a leaf name case-insensitively', () => {
    expect(match('groceries', 'expense')).toBe('det-groceries');
    expect(match('  GROCERIES  ', 'expense')).toBe('det-groceries');
  });

  it('matches the leaf of a MS Money Parent:Sub path', () => {
    expect(match('Food:Groceries', 'expense')).toBe('det-groceries');
    expect(match('Bills:Electric', 'expense')).toBe('det-electric');
    expect(match('Bills/Electric', 'expense')).toBe('det-electric');
  });

  it('disambiguates a name under two parents by the parent segment', () => {
    expect(match('Bills:Other', 'expense')).toBe('det-other-exp');
    expect(match('Income:Other', 'income')).toBe('det-other-inc');
  });

  it('disambiguates by transaction direction when the parent is absent', () => {
    expect(match('Other', 'income')).toBe('det-other-inc');
    expect(match('Other', 'expense')).toBe('det-other-exp');
  });

  it('returns null when nothing matches', () => {
    expect(match('Nonexistent', 'expense')).toBeNull();
    expect(match('', 'expense')).toBeNull();
  });

  it('ignores sub/parent categories — transactions use detail leaves', () => {
    expect(match('Bills', 'expense')).toBeNull();
  });

  it('skips inactive categories', () => {
    const matcher = buildCategoryMatcher([
      ...cats,
      { id: 'det-dead', name: 'DeadCat', type: 'expense', level: 'detail', parentId: 'sub-bills', isActive: false }
    ]);
    expect(matcher.match('DeadCat', 'expense')).toBeNull();
  });
});
