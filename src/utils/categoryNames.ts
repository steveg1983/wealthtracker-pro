import type { Category } from '../types';

/**
 * One definition of how a category is NAMED for display: "Parent : Child"
 * (the Money convention used across this app), with "Uncategorised" for a
 * missing or dangling id.
 *
 * A raw category id must never reach a screen, a PDF or a CSV — ids are
 * UUIDs and mean nothing to the user. Resolve through this lookup instead of
 * printing `transaction.category`.
 *
 * `separator` exists for the interchange formats, which punctuate the same
 * idea differently: QIF spells a subcategory `Parent:Child`, unpadded, and an
 * importer reading our padded form would create categories with a trailing
 * and a leading space. The NAME is the same either way — only the punctuation
 * between the two halves moves, and it moves here rather than by patching the
 * finished string somewhere downstream.
 */
export function buildCategoryNameLookup(
  categories: Category[],
  separator: string = ' : '
): (id: string | null | undefined) => string {
  const byId = new Map(categories.map(c => [c.id, c]));
  return (id: string | null | undefined): string => {
    if (!id) return 'Uncategorised';
    const category = byId.get(id);
    if (!category) return 'Uncategorised';
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    // The top 'type' nodes ("Income"/"Expense") add nothing to a label.
    return parent && parent.level !== 'type' ? `${parent.name}${separator}${category.name}` : category.name;
  };
}
