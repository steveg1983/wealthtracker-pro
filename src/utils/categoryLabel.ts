import type { Account, Category, Transaction } from '../types';

/**
 * Everything a row needs to say what its Category column reads.
 *
 * Deliberately narrower than Transaction: the register's lead "Opening
 * Balance" line is not a transaction and has no id, no amount and no
 * transferAccountId, and it still has to be labelled (as nothing) by the same
 * function as every row beneath it.
 */
export interface CategoryLabelSubject {
  category: string;
  type?: Transaction['type'];
  transferAccountId?: string;
}

/**
 * THE text the account register shows in its Category column — and, because it
 * is the same function, the text that column sorts by.
 *
 * ─ WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * It used to be two functions, and they disagreed. The column resolved a
 * transfer to "Transfer > Savings" and a filed row to its whole path,
 * "Food > Groceries"; the sort key was `categories.find(c => c.id ===
 * t.category)?.name`, which is the LEAF alone and nothing at all for a
 * transfer entered by hand (those carry the literal category 'transfer-out',
 * which is no category's id).
 *
 * Both halves of that showed. Every transfer scored exactly what a blank row
 * scores — the empty string — so the two kinds tied, the comparator's
 * chronological tie-break laid the whole block out by date, and the owner's
 * register came back in date order under a column header that said Category.
 * And the rows that DID resolve came out ordered by their leaf (Groceries,
 * Insurance, Water) while the column showed their paths (Food >, Home >,
 * Bills >), so even the categorised rows read as unsorted.
 *
 * One function, used by the cell and by the comparator, is the only thing that
 * keeps a column sorted by what it says. Anything else is two definitions of
 * one column waiting to drift apart again.
 *
 * ─ WHY A FACTORY ───────────────────────────────────────────────────────────
 * A sort of an 11,000-row register performs ~150,000 comparisons; resolving a
 * label with two Array.prototype.find scans per comparison is tens of millions
 * of passes over the category list. The maps are built once per (categories,
 * accounts) pair and each distinct label is worked out once — so the cost is
 * the number of DISTINCT categories, not the number of comparisons.
 *
 * The cache is keyed by what the answer depends on and nothing else, so it can
 * never hand back another row's label. Hold the returned function no longer
 * than the arrays it was built from (the register memoises it on exactly those
 * two), or it will keep answering with categories that have since been renamed.
 */
export function createCategoryLabeller(
  categories: readonly Category[],
  accounts: readonly Account[]
): (subject: CategoryLabelSubject) => string {
  const categoryById = new Map(categories.map(category => [category.id, category] as const));
  const accountNameById = new Map(accounts.map(account => [account.id, account.name] as const));
  const cache = new Map<string, string>();

  const resolve = (subject: CategoryLabelSubject): string => {
    const categoryId = subject.category;

    // A transfer shows where the money went, not the bookkeeping category it
    // was filed under. 'transfer-out'/'transfer-in' are the literal ids the
    // quick-add dock and the edit modal write when the other account has no
    // To/From category of its own; an account-managed transfer category is a
    // real category and falls through to the lookup below, which is what shows
    // its own name.
    if (
      subject.type === 'transfer' &&
      subject.transferAccountId &&
      (categoryId === 'transfer-out' || categoryId === 'transfer-in')
    ) {
      return `Transfer > ${accountNameById.get(subject.transferAccountId) ?? 'Unknown'}`;
    }

    const category = categoryById.get(categoryId);
    // An id that resolves to nothing reads as nothing. A raw uuid, or a slug
    // prettied up into a category name the user never created, would both be
    // the register inventing a categorisation that is not in the data.
    if (!category) return '';

    if (category.parentId) {
      const parent = categoryById.get(category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }

    return category.name;
  };

  return (subject: CategoryLabelSubject): string => {
    if (!subject.category) return '';
    // The transfer branch is the only one that reads a second field, so it is
    // the only one that needs a second part to its key. The two shapes are
    // prefixed apart so no pair of ids can ever spell another pair's key.
    const key =
      subject.type === 'transfer' && subject.transferAccountId
        ? `transfer:${subject.category}:${subject.transferAccountId}`
        : `category:${subject.category}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const label = resolve(subject);
    cache.set(key, label);
    return label;
  };
}
