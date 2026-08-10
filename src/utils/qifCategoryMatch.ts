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
  /**
   * TRANSFER CATEGORIES ARE NOT MATCH TARGETS.
   *
   * They are `level: 'detail'` like any leaf, so a QIF line reading
   * `LTo/From Savings` — which Money exports happily produce — would otherwise
   * match one by name and file the imported row under it. The row's type comes
   * from the sign of its amount ('income' or 'expense'), never 'transfer', and
   * no counterpart is created: the result is a row that every report drops
   * (`classifyFlow` reads the category), that the uncategorised review band
   * never shows (it has a real category id), and that still moves the balance.
   *
   * A transfer needs its OTHER SIDE, which an importer matching a name cannot
   * create — it has no way to know whether the row in the other account is
   * already in the file. Leaving the row uncategorised puts it in the review
   * band where the user can convert it properly, which is exactly what the
   * unmatched-category report is for.
   */
  const details = active.filter(c => c.level === 'detail' && c.isTransferCategory !== true);

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
