import { MS_MONEY_CATEGORY_SET } from './msMoneyCategories';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
  isRevaluationCategory?: boolean;
}

export function getMinimalSystemCategories(): Category[] {
  return [
    // Only the essential system categories
    { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
    { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },

    // Transfer detail categories (required for transfers to work)
    { id: 'transfer-in', name: 'Transfer In', type: 'both', level: 'detail', parentId: 'type-transfer', isSystem: true },
    { id: 'transfer-out', name: 'Transfer Out', type: 'both', level: 'detail', parentId: 'type-transfer', isSystem: true },

    // Revaluation: a change in an account's VALUE, neither income nor expense
    { id: 'type-revaluation', name: 'Revaluation', type: 'both', level: 'type', isSystem: true, isRevaluationCategory: true },
    { id: 'revaluation-market', name: 'Market Value Change', type: 'both', level: 'detail', parentId: 'type-revaluation', isSystem: true, isRevaluationCategory: true },
  ];
}

/** Deterministic slug for default category ids ("Cars & Bikes" → "cars-bikes"). */
const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * The default category tree every new user starts with: the classic
 * Microsoft Money (UK) set (src/data/msMoneyCategories.ts) plus the system
 * categories the app itself needs (type anchors, transfer in/out, and the
 * Adjustments bucket used by balance-repair tooling).
 */
export function getDefaultCategories(): Category[] {
  const categories: Category[] = [
    // Type level categories
    { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
    { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },

    // System adjustment bucket (used by Data Validation balance repair)
    { id: 'sub-adjustments', name: 'Adjustments', type: 'both', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'account-adjustments', name: 'Account Adjustments', type: 'both', level: 'detail', parentId: 'sub-adjustments', isSystem: true },

    // Transfer categories
    { id: 'transfer-in', name: 'Transfer In', type: 'both', level: 'detail', parentId: 'type-transfer', isSystem: true },
    { id: 'transfer-out', name: 'Transfer Out', type: 'both', level: 'detail', parentId: 'type-transfer', isSystem: true },

    // Revaluation categories (portfolio value changes — not income/expense/transfer)
    { id: 'type-revaluation', name: 'Revaluation', type: 'both', level: 'type', isSystem: true, isRevaluationCategory: true },
    { id: 'revaluation-market', name: 'Market Value Change', type: 'both', level: 'detail', parentId: 'type-revaluation', isSystem: true, isRevaluationCategory: true },
  ];

  for (const group of MS_MONEY_CATEGORY_SET) {
    const subId = `sub-${slugify(group.name)}`;
    categories.push({
      id: subId,
      name: group.name,
      type: group.type,
      level: 'sub',
      parentId: `type-${group.type}`,
    });

    // Empty group → one self-named detail so it stays selectable (matches the
    // Money-set import behaviour in utils/categoryTreeImport.ts).
    const children = group.children.length > 0 ? group.children : [group.name];
    for (const child of children) {
      categories.push({
        id: `${slugify(group.name)}--${slugify(child)}`,
        name: child,
        type: group.type,
        level: 'detail',
        parentId: subId,
      });
    }
  }

  return categories;
}
