import type { Category } from '../types';

/**
 * What a row with no category is CALLED, everywhere, in one place.
 *
 * It was written out by hand in each place that needed it, and the two halves
 * of the app drifted into disagreeing about the spelling: this module and the
 * payee reports said "Uncategorised", while CategoryContext's own path lookup,
 * the category dropdown and the QIF export said "Uncategorized". Both were
 * reachable from the same screen, so the app contradicted itself in the space
 * of one page — under dates it prints dd/mm/yyyy and a currency it prints in
 * pounds. A constant rather than a convention, because a convention is what
 * just failed.
 */
export const UNCATEGORISED_LABEL = 'Uncategorised';

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
    if (!id) return UNCATEGORISED_LABEL;
    const category = byId.get(id);
    if (!category) return UNCATEGORISED_LABEL;
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    // The top 'type' nodes ("Income"/"Expense") add nothing to a label.
    return parent && parent.level !== 'type' ? `${parent.name}${separator}${category.name}` : category.name;
  };
}
