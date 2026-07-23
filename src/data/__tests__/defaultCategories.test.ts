import { describe, it, expect } from 'vitest';
import { getDefaultCategories, getMinimalSystemCategories } from '../defaultCategories';
import { MS_MONEY_CATEGORY_SET } from '../msMoneyCategories';

describe('getDefaultCategories (Microsoft Money default set)', () => {
  const defaults = getDefaultCategories();

  it('has globally unique ids', () => {
    const ids = defaults.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every system category the app depends on', () => {
    for (const required of ['type-income', 'type-expense', 'type-transfer',
      'transfer-in', 'transfer-out', 'sub-adjustments', 'account-adjustments',
      'type-revaluation', 'revaluation-market']) {
      expect(defaults.some(c => c.id === required)).toBe(true);
    }
  });

  it('flags the revaluation categories so the classifier rules them out of spending', () => {
    for (const id of ['type-revaluation', 'revaluation-market']) {
      expect(defaults.find(c => c.id === id)?.isRevaluationCategory).toBe(true);
    }
  });

  it('contains every Microsoft Money group as a sub under the right anchor', () => {
    for (const group of MS_MONEY_CATEGORY_SET) {
      const sub = defaults.find(c => c.level === 'sub' && c.name === group.name && c.type === group.type);
      expect(sub, `missing group ${group.name}`).toBeDefined();
      expect(sub!.parentId).toBe(`type-${group.type}`);
    }
  });

  it('contains every Money subcategory as a selectable detail under its group', () => {
    for (const group of MS_MONEY_CATEGORY_SET) {
      const sub = defaults.find(c => c.level === 'sub' && c.name === group.name && c.type === group.type)!;
      const children = group.children.length > 0 ? group.children : [group.name];
      for (const child of children) {
        const detail = defaults.find(c => c.level === 'detail' && c.parentId === sub.id && c.name === child);
        expect(detail, `missing detail ${group.name} > ${child}`).toBeDefined();
      }
    }
  });

  it('every non-type category resolves to an existing parent', () => {
    const ids = new Set(defaults.map(c => c.id));
    for (const c of defaults) {
      if (c.level === 'type') continue;
      expect(c.parentId && ids.has(c.parentId), `${c.name} has dangling parent`).toBe(true);
    }
  });

  it('minimal system set carries the type anchors, transfers and revaluation', () => {
    expect(getMinimalSystemCategories().map(c => c.id)).toEqual([
      'type-income', 'type-expense', 'type-transfer', 'transfer-in', 'transfer-out',
      'type-revaluation', 'revaluation-market',
    ]);
  });
});
