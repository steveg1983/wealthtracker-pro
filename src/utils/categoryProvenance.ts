/**
 * Category provenance — "did a human vouch for this, or did the app guess?"
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Imports fill categories in: the smart categoriser on a statement file, payee
 * memory on a bank feed. A filled-in category looked exactly like one the user
 * had chosen, so the register could not answer the only question that matters
 * while working through a fresh import — "have I checked this row yet?". The
 * answer was somewhere between "all of them" and "none of them", which is the
 * same as no answer.
 *
 * The fix is not to stop guessing. A guess is usually right and re-typing it is
 * the drudgery the guess exists to remove. The fix is to say out loud that it
 * IS a guess, and to make agreeing with it one click.
 *
 * ── THE RULE, IN ONE PLACE ──────────────────────────────────────────────────
 * `categoryConfirmed === false` means "the app filled this in and nobody has
 * agreed yet". EVERY other value — true, undefined, missing — means confirmed.
 * That asymmetry is deliberate and load-bearing:
 *
 *   * The column is `NOT NULL DEFAULT true`, so any writer that has never heard
 *     of provenance produces a confirmed row. Only the two paths that actually
 *     guess say false.
 *   * `undefined` is what every row carries on a database that has not had the
 *     migration applied yet, and on the local/demo store. Reading that as
 *     "suggested" would paint a badge on every transaction the user owns.
 *   * The backfill treats existing history as confirmed (see the migration), so
 *     "unmarked" and "confirmed" must mean the same thing everywhere or the
 *     screen and the table disagree.
 */

import type { Transaction } from '../types';

/** Enough of a transaction to judge its category provenance. */
export type CategoryProvenanceRow = Pick<Transaction, 'category' | 'categoryConfirmed'>;

/** Is there a category here at all? A blank has nothing to confirm. */
export function hasCategory(category: string | null | undefined): boolean {
  return typeof category === 'string' && category.trim() !== '';
}

/**
 * A category the app guessed and the user has not yet agreed with.
 *
 * Note the `=== false`: see the asymmetry above. A row with no category is
 * never "suggested" — it is uncategorised, which the app already says loudly in
 * its own right and which the Categorisation page already counts separately.
 */
export function isCategorySuggested(row: CategoryProvenanceRow): boolean {
  return row.categoryConfirmed === false && hasCategory(row.category);
}

/**
 * A category a human stands behind: one they typed, picked, edited, or which
 * came out of their own file (a QIF/Money category is the user's own data, not
 * the app's opinion of it).
 *
 * Rows with no category answer false here AND false to isCategorySuggested —
 * there is nothing to vouch for either way, and the two questions are not
 * opposites.
 */
export function isCategoryConfirmed(row: CategoryProvenanceRow): boolean {
  return row.categoryConfirmed !== false && hasCategory(row.category);
}

/** Enough of a transaction to judge whether its category is one a user can answer for. */
export type ConfirmableCategoryRow = CategoryProvenanceRow & Pick<Transaction, 'type' | 'isSplit'>;

/**
 * A suggestion the user can actually do something about.
 *
 * WHY THIS IS NARROWER than isCategorySuggested. Two kinds of row carry a
 * category nobody can confirm on its own terms:
 *
 *   * a TRANSFER files under a system To/From category that follows the account
 *     it moves money to — there is no judgement to make, and every editor in the
 *     app shows "Transfer" instead of a picker;
 *   * a SPLIT categorises in its lines, not in the parent row (the database
 *     guard rejects a single-category write to it), so the parent's category is
 *     not a thing to agree with either.
 *
 * Marking those "Suggested" would put a badge on a row whose editor offers no
 * way to answer it — an accusation with no reply, and the surest way to teach
 * people to ignore the badge everywhere else.
 */
export function isConfirmableSuggestion(row: ConfirmableCategoryRow): boolean {
  return row.type !== 'transfer' && row.isSplit !== true && isCategorySuggested(row);
}

/** Every row whose category is still only a suggestion, input order kept. */
export function suggestedRows<T extends CategoryProvenanceRow>(rows: readonly T[]): T[] {
  return rows.filter(row => isCategorySuggested(row));
}

/** Suggested rows sharing one guessed category. */
export interface SuggestedCategoryGroup<T> {
  /** The category the app guessed for every row in `rows`. */
  categoryId: string;
  rows: T[];
}

/**
 * Suggested rows gathered by the category that was guessed for them, biggest
 * group first.
 *
 * WHY GROUPED. Checking a suggestion one row at a time is the drudgery the
 * suggestion was meant to remove, and a single "confirm everything" button is
 * not checking at all — it just relabels guesses as decisions in bulk, which is
 * the exact confusion this feature exists to end. A group is the honest middle:
 * "these 43 rows were all guessed as Groceries" is one glance and one judgement,
 * and the user can drop into the list if the answer is not obvious.
 *
 * Ties are broken by category id so two runs over the same data always produce
 * the same order — a list that reshuffles itself between renders is unusable for
 * a chore you work down.
 */
export function groupSuggestedByCategory<T extends CategoryProvenanceRow>(
  rows: readonly T[]
): SuggestedCategoryGroup<T>[] {
  const byCategory = new Map<string, T[]>();
  for (const row of suggestedRows(rows)) {
    const key = row.category.trim();
    const existing = byCategory.get(key);
    if (existing) {
      existing.push(row);
    } else {
      byCategory.set(key, [row]);
    }
  }

  return Array.from(byCategory, ([categoryId, groupRows]) => ({ categoryId, rows: groupRows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.categoryId.localeCompare(b.categoryId));
}

/** One account's suggestions, gathered by the category guessed for them. */
export interface SuggestedAccountGroup<T> {
  accountId: string;
  /** Every suggested row in this account, across its categories. */
  rows: T[];
  /** Those rows by guessed category, biggest group first. */
  categories: SuggestedCategoryGroup<T>[];
}

/**
 * Suggested rows gathered by ACCOUNT, each account's category groups beneath
 * it (owner, 24 Aug: "view the suggested ones by account, and then the list
 * of suggested categories below each").
 *
 * Why both views exist. A guess is judged against its CATEGORY first — "are
 * these forty really groceries?" — which is why that stays the default. But
 * a guess also has a provenance the category view hides: one card's import
 * can produce a run of suggestions that a glance at the account would settle
 * in one go. Same rows, same confirm, different question.
 *
 * Worst first, ties broken by account NAME rather than by arrival order, for
 * the reason groupUncategorisedByAccount states: a list that reorders itself
 * under your thumb is how you tap the wrong row.
 */
export function groupSuggestedByAccount<T extends CategoryProvenanceRow & { accountId: string }>(
  rows: readonly T[],
  accountName: (accountId: string) => string
): SuggestedAccountGroup<T>[] {
  const byAccount = new Map<string, T[]>();
  for (const row of suggestedRows(rows)) {
    const existing = byAccount.get(row.accountId);
    if (existing) existing.push(row);
    else byAccount.set(row.accountId, [row]);
  }

  return Array.from(byAccount, ([accountId, accountRows]) => ({
    accountId,
    rows: accountRows,
    // The same grouping the category view uses, so a category means the same
    // thing on both — one implementation, no second sort to drift.
    categories: groupSuggestedByCategory(accountRows),
  })).sort(
    (a, b) =>
      b.rows.length - a.rows.length ||
      accountName(a.accountId).localeCompare(accountName(b.accountId))
  );
}
