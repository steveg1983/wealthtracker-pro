import { describe, it, expect } from 'vitest';
import {
  hasCategory,
  isCategorySuggested,
  isCategoryConfirmed,
  isConfirmableSuggestion,
  suggestedRows,
  groupSuggestedByCategory,
  type CategoryProvenanceRow,
  type ConfirmableCategoryRow,
} from '../categoryProvenance';

const row = (category: string, categoryConfirmed?: boolean): CategoryProvenanceRow =>
  categoryConfirmed === undefined ? { category } : { category, categoryConfirmed };

describe('hasCategory', () => {
  it('is false for blank, whitespace, null and undefined', () => {
    expect(hasCategory('')).toBe(false);
    expect(hasCategory('   ')).toBe(false);
    expect(hasCategory(null)).toBe(false);
    expect(hasCategory(undefined)).toBe(false);
  });

  it('is true for a real category id', () => {
    expect(hasCategory('cat-groceries')).toBe(true);
  });
});

describe('isCategorySuggested', () => {
  it('is true only when the app filled it in and nobody has agreed', () => {
    expect(isCategorySuggested(row('cat-groceries', false))).toBe(true);
  });

  it('is false when the user vouched for it', () => {
    expect(isCategorySuggested(row('cat-groceries', true))).toBe(false);
  });

  /**
   * The load-bearing asymmetry. A database without the migration returns no
   * such key, and so does the local/demo store — reading that as "suggested"
   * would badge every transaction the user has ever typed.
   */
  it('treats an ABSENT flag as confirmed, never as suggested', () => {
    expect(isCategorySuggested(row('cat-groceries'))).toBe(false);
    expect(isCategoryConfirmed(row('cat-groceries'))).toBe(true);
  });

  it('is false for a blank category, however the flag reads', () => {
    // An uncategorised row is a different chore with its own screen. Marking it
    // "suggested" would put rows with nothing in them on the list of guesses to
    // check, where there is nothing to look at.
    expect(isCategorySuggested(row('', false))).toBe(false);
    expect(isCategorySuggested(row('   ', false))).toBe(false);
  });

  it('answers false to BOTH questions for a blank — they are not opposites', () => {
    expect(isCategorySuggested(row(''))).toBe(false);
    expect(isCategoryConfirmed(row(''))).toBe(false);
  });
});

describe('isConfirmableSuggestion', () => {
  const guessed = (
    over: Partial<ConfirmableCategoryRow> = {}
  ): ConfirmableCategoryRow => ({
    category: 'cat-groceries',
    categoryConfirmed: false,
    type: 'expense',
    ...over,
  });

  it('is true for an ordinary guessed row — there is a judgement to make', () => {
    expect(isConfirmableSuggestion(guessed())).toBe(true);
  });

  it('never marks a transfer, whose category follows the account it moves money to', () => {
    expect(isConfirmableSuggestion(guessed({ type: 'transfer' }))).toBe(false);
  });

  it('never marks a split parent, which is categorised in its lines', () => {
    expect(isConfirmableSuggestion(guessed({ isSplit: true }))).toBe(false);
  });

  it('still says no to everything isCategorySuggested says no to', () => {
    expect(isConfirmableSuggestion(guessed({ categoryConfirmed: true }))).toBe(false);
    expect(isConfirmableSuggestion(guessed({ categoryConfirmed: undefined }))).toBe(false);
    expect(isConfirmableSuggestion(guessed({ category: '' }))).toBe(false);
  });
});

describe('suggestedRows', () => {
  it('keeps only the unconfirmed, in input order', () => {
    const rows = [
      { id: 'a', ...row('cat-groceries', false) },
      { id: 'b', ...row('cat-fuel', true) },
      { id: 'c', ...row('cat-dining', false) },
      { id: 'd', ...row('') },
    ];
    expect(suggestedRows(rows).map(r => r.id)).toEqual(['a', 'c']);
  });
});

describe('groupSuggestedByCategory', () => {
  it('gathers suggestions by the category that was guessed, biggest group first', () => {
    const rows = [
      { id: 'a', ...row('cat-groceries', false) },
      { id: 'b', ...row('cat-dining', false) },
      { id: 'c', ...row('cat-groceries', false) },
      { id: 'd', ...row('cat-groceries', false) },
      { id: 'e', ...row('cat-dining', false) },
    ];
    const groups = groupSuggestedByCategory(rows);
    expect(groups.map(g => [g.categoryId, g.rows.length])).toEqual([
      ['cat-groceries', 3],
      ['cat-dining', 2],
    ]);
  });

  it('leaves confirmed and uncategorised rows out entirely', () => {
    const rows = [
      { id: 'a', ...row('cat-groceries', true) },
      { id: 'b', ...row('') },
      { id: 'c', ...row('cat-fuel', false) },
    ];
    const groups = groupSuggestedByCategory(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].categoryId).toBe('cat-fuel');
    expect(groups[0].rows.map(r => r.id)).toEqual(['c']);
  });

  it('orders equal-sized groups deterministically, so the list cannot reshuffle', () => {
    const rows = [
      { id: 'a', ...row('cat-zebra', false) },
      { id: 'b', ...row('cat-apple', false) },
    ];
    expect(groupSuggestedByCategory(rows).map(g => g.categoryId)).toEqual(['cat-apple', 'cat-zebra']);
    // Same data, opposite input order — same output order.
    expect(groupSuggestedByCategory([...rows].reverse()).map(g => g.categoryId))
      .toEqual(['cat-apple', 'cat-zebra']);
  });

  it('returns nothing when nothing was guessed', () => {
    expect(groupSuggestedByCategory([row('cat-a', true), row('')])).toEqual([]);
  });
});
