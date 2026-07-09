import type { Category } from '../types';

/**
 * Match category NAMES carried in a QIF file (the `L` field, e.g. MS Money's
 * "Bills:Utilities") to the detail categories the user already has in the app,
 * so imported transactions inherit real category IDs instead of raw text.
 *
 * Matching is normalized (case/'spacing'-insensitive) and hierarchy-aware:
 * the leaf segment is matched first, disambiguated by the parent segment and
 * then the transaction's direction when a name exists under more than one
 * parent. Returns null when there is no confident match — the caller keeps the
 * original text and reports it, rather than guessing wrong.
 */

export interface CategoryMatcher {
  match: (qifCategory: string, txnType: 'income' | 'expense' | 'transfer') => string | null;
}

const norm = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const splitPath = (raw: string): string[] =>
  raw.split(/[:/>]/).map(norm).filter(Boolean);

export function buildCategoryMatcher(categories: Category[]): CategoryMatcher {
  const active = categories.filter(c => c.isActive !== false);
  const byId = new Map(active.map(c => [c.id, c]));
  const details = active.filter(c => c.level === 'detail');

  // Normalized detail name -> the detail categories carrying it. A name can
  // legitimately exist under several parents (e.g. "Other").
  const detailByName = new Map<string, Category[]>();
  for (const detail of details) {
    const key = norm(detail.name);
    const existing = detailByName.get(key);
    if (existing) {
      existing.push(detail);
    } else {
      detailByName.set(key, [detail]);
    }
  }

  const parentNameOf = (category: Category): string | null => {
    if (!category.parentId) {
      return null;
    }
    const parent = byId.get(category.parentId);
    return parent ? norm(parent.name) : null;
  };

  const match = (qifCategory: string, txnType: 'income' | 'expense' | 'transfer'): string | null => {
    if (!qifCategory) {
      return null;
    }
    const segments = splitPath(qifCategory);
    if (segments.length === 0) {
      return null;
    }
    const leaf = segments[segments.length - 1];
    const parent = segments.length >= 2 ? segments[segments.length - 2] : null;

    let candidates = detailByName.get(leaf);
    if (!candidates || candidates.length === 0) {
      return null;
    }
    if (candidates.length === 1) {
      return candidates[0].id;
    }

    // Disambiguate by the parent segment from the QIF path.
    if (parent) {
      const byParent = candidates.filter(c => parentNameOf(c) === parent);
      if (byParent.length === 1) {
        return byParent[0].id;
      }
      if (byParent.length > 1) {
        candidates = byParent;
      }
    }

    // Then by transaction direction ('both' is always eligible).
    if (txnType === 'income' || txnType === 'expense') {
      const byType = candidates.filter(c => c.type === txnType || c.type === 'both');
      if (byType.length >= 1) {
        candidates = byType;
      }
    }

    return candidates[0]?.id ?? null;
  };

  return { match };
}
