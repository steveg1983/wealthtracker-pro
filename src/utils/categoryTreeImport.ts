import type { Category } from '../types';

/** One Money-style category with its selectable subcategories. */
export interface CategoryTreeGroup {
  name: string;
  type: 'income' | 'expense';
  /** Detail names. Empty → a single detail with the group's own name is created. */
  children: string[];
}

export interface CategoryTreePlan {
  /** Missing sub-level categories, ready to insert (parentId = the type anchor). */
  subsToCreate: Array<Omit<Category, 'id'>>;
  /**
   * Missing detail-level categories. parentId is resolved AFTER the subs
   * insert (a detail's parent may be created in the same import), so each
   * entry carries the (type, subName) key to look the parent up by.
   */
  detailsToCreate: Array<{
    subName: string;
    type: 'income' | 'expense';
    category: Omit<Category, 'id' | 'parentId'>;
  }>;
  /** Sub/detail entries skipped because a same-named category already exists. */
  skippedCount: number;
  /** Total sub + detail entries in the requested tree. */
  totalCount: number;
}

const norm = (name: string): string => name.trim().toLowerCase();

/**
 * Diff a Money-style category tree against the user's existing categories.
 *
 * Matching is case-insensitive by (parent, name) so re-importing is a no-op
 * and overlaps with the default set (e.g. an existing "Investment Income"
 * sub) merge instead of duplicating. Throws if a type anchor is missing —
 * every account has the system Income/Expense type categories, so a missing
 * anchor means categories haven't loaded and importing would misfile the tree.
 */
export function planCategoryTreeImport(
  existing: Category[],
  tree: CategoryTreeGroup[]
): CategoryTreePlan {
  const typeAnchors: Record<'income' | 'expense', string | undefined> = {
    income: existing.find(c => c.level === 'type' && c.type === 'income')?.id,
    expense: existing.find(c => c.level === 'type' && c.type === 'expense')?.id,
  };
  if (!typeAnchors.income || !typeAnchors.expense) {
    throw new Error('Cannot import categories: the Income/Expense type categories are not loaded yet.');
  }

  const subsToCreate: CategoryTreePlan['subsToCreate'] = [];
  const detailsToCreate: CategoryTreePlan['detailsToCreate'] = [];
  let skippedCount = 0;
  let totalCount = 0;

  for (const group of tree) {
    const anchorId = typeAnchors[group.type]!;
    totalCount += 1;

    const existingSub = existing.find(
      c => c.level === 'sub' && c.parentId === anchorId && norm(c.name) === norm(group.name)
    );

    if (existingSub) {
      skippedCount += 1;
    } else {
      subsToCreate.push({
        name: group.name,
        type: group.type,
        level: 'sub',
        parentId: anchorId,
        isActive: true,
      });
    }

    // Empty group → one detail named after the group so it stays selectable.
    const detailNames = group.children.length > 0 ? group.children : [group.name];

    for (const detailName of detailNames) {
      totalCount += 1;
      const existingDetail = existingSub
        ? existing.find(
            c => c.level === 'detail' && c.parentId === existingSub.id && norm(c.name) === norm(detailName)
          )
        : undefined;

      if (existingDetail) {
        skippedCount += 1;
      } else {
        detailsToCreate.push({
          subName: group.name,
          type: group.type,
          category: {
            name: detailName,
            type: group.type,
            level: 'detail',
            isActive: true,
          },
        });
      }
    }
  }

  return { subsToCreate, detailsToCreate, skippedCount, totalCount };
}
