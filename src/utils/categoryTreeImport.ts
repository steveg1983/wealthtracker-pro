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

export interface CategoryPrunePlan {
  /** Detail-level ids safe to delete (unused, non-system, not in the tree). */
  detailIdsToDelete: string[];
  /** Sub-level ids safe to delete (all children pruned, not a tree group). */
  subIdsToDelete: string[];
  /** Categories kept only because transactions still reference them. */
  keptForTransactionsCount: number;
}

/**
 * Plan the removal of categories that are NOT part of the given tree — used to
 * turn "merge the Money set in" into "make my categories BE the Money set".
 *
 * Never prunes: type anchors, system categories, transfer categories, anything
 * under the Transfer anchor, tree members, or any category still referenced by
 * a transaction (those are counted in keptForTransactionsCount instead).
 */
export function planCategoryPrune(
  existing: Category[],
  tree: CategoryTreeGroup[],
  usedCategoryIds: ReadonlySet<string>
): CategoryPrunePlan {
  const incomeAnchor = existing.find(c => c.level === 'type' && c.type === 'income')?.id;
  const expenseAnchor = existing.find(c => c.level === 'type' && c.type === 'expense')?.id;

  const groupNames = new Map<string, Set<string>>([
    ['income', new Set(tree.filter(g => g.type === 'income').map(g => norm(g.name)))],
    ['expense', new Set(tree.filter(g => g.type === 'expense').map(g => norm(g.name)))],
  ]);
  // Details keyed by (type, group name, detail name); empty groups self-fill.
  const detailKeys = new Set<string>();
  for (const group of tree) {
    const children = group.children.length > 0 ? group.children : [group.name];
    for (const child of children) {
      detailKeys.add(`${group.type}:${norm(group.name)}:${norm(child)}`);
    }
  }

  const anchorTypeOf = (parentId: string | null | undefined): 'income' | 'expense' | null =>
    parentId === incomeAnchor ? 'income' : parentId === expenseAnchor ? 'expense' : null;

  // Protection is by IDENTITY, not by the isSystem flag: the legacy seed
  // stamped isSystem on ordinary default subs (Housing, Transport, …) — the
  // very categories this prune exists to remove. The genuinely load-bearing
  // rows are the type anchors, transfer categories, and the Adjustments
  // bucket used by balance-repair tooling (matched by name — cloud ids are
  // per-user UUIDs).
  const isAdjustmentsBucket = (c: Category): boolean =>
    (c.level === 'sub' && norm(c.name) === 'adjustments' && c.type === 'both') ||
    (c.level === 'detail' && norm(c.name) === 'account adjustments' && c.type === 'both');

  const isProtected = (c: Category): boolean =>
    c.level === 'type' || c.isTransferCategory === true ||
    c.id === 'transfer-in' || c.id === 'transfer-out' ||
    isAdjustmentsBucket(c);

  const detailIdsToDelete: string[] = [];
  const subIdsToDelete: string[] = [];
  let keptForTransactionsCount = 0;

  const subs = existing.filter(c => c.level === 'sub' && anchorTypeOf(c.parentId) !== null);

  for (const sub of subs) {
    const subProtected = isProtected(sub);
    const subType = anchorTypeOf(sub.parentId)!;
    const subInTree = groupNames.get(subType)!.has(norm(sub.name));

    // A protected sub is never deleted itself, but its non-tree details ARE
    // still candidates — otherwise legacy isSystem subs would smuggle their
    // whole default detail set past the prune.
    const details = existing.filter(c => c.level === 'detail' && c.parentId === sub.id);
    let allDetailsPruned = true;

    for (const detail of details) {
      if (isProtected(detail)) {
        allDetailsPruned = false;
        continue;
      }
      const detailInTree = detailKeys.has(`${subType}:${norm(sub.name)}:${norm(detail.name)}`);
      if (detailInTree) {
        allDetailsPruned = false;
        continue;
      }
      if (usedCategoryIds.has(detail.id)) {
        keptForTransactionsCount += 1;
        allDetailsPruned = false;
        continue;
      }
      detailIdsToDelete.push(detail.id);
    }

    if (!subProtected && !subInTree && allDetailsPruned) {
      if (usedCategoryIds.has(sub.id)) {
        keptForTransactionsCount += 1;
      } else {
        subIdsToDelete.push(sub.id);
      }
    }
  }

  return { detailIdsToDelete, subIdsToDelete, keptForTransactionsCount };
}

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
