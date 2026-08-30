import { describe, it, expect } from 'vitest';
import { toDecimal } from '../../utils/decimal';
import { adjustmentCategoryIdFor, openingPositionRow } from './openingPosition';

/**
 * WHAT AN UNFUNDED HOLDING WRITES INTO THE REGISTER — the decision that made
 * a retrospectively recorded portfolio worth £0.00 everywhere except the
 * Portfolio tab (owner, 30 Aug 2026). The valuation model needs the cost in
 * the ledger; this helper is the single place that says when it goes in.
 *
 * Every figure invented: this repo is public.
 */

const CATEGORIES = [
  { id: 'cat-groceries', name: 'Food Shopping', level: 'detail' },
  { id: 'cat-reval-type', name: 'Revaluation', level: 'type', isRevaluationCategory: true },
  { id: 'cat-market', name: 'Market Value Change', level: 'detail', isRevaluationCategory: true },
  { id: 'cat-adjust', name: 'Account Adjustment', level: 'detail', isRevaluationCategory: true },
];

const base = {
  fundingAccountId: null,
  costInAccountMoney: toDecimal('12345.67'),
  quantity: toDecimal('80'),
  symbol: 'SYNTH',
  date: new Date('2019-03-01T00:00:00'),
  categories: CATEGORIES,
};

describe('the opening-position register row', () => {
  it('writes the cost, dated the purchase, filed as an adjustment', () => {
    const { row, skipped } = openingPositionRow(base);
    expect(skipped).toBeNull();
    expect(row).not.toBeNull();
    expect(row!.amount.toString()).toBe('12345.67');
    expect(row!.categoryId).toBe('cat-adjust');
    expect(row!.description).toBe('Opening position — 80 SYNTH');
    expect(row!.date).toEqual(base.date);
  });

  it('writes nothing for a funded buy — the transfer already carries the cost', () => {
    const { row, skipped } = openingPositionRow({ ...base, fundingAccountId: 'acc-cash' });
    expect(row).toBeNull();
    expect(skipped).toBe('funded');
  });

  it('writes nothing when no account-money cost exists — the foreign-priced case', () => {
    const { row, skipped } = openingPositionRow({ ...base, costInAccountMoney: null });
    expect(row).toBeNull();
    expect(skipped).toBe('foreign');
  });

  it('says so, rather than guessing, when no revaluation category exists', () => {
    const { row, skipped } = openingPositionRow({
      ...base,
      categories: [{ id: 'cat-x', name: 'Food Shopping', level: 'detail' }],
    });
    expect(row).toBeNull();
    expect(skipped).toBe('no_category');
  });
});

describe('which category the row files under', () => {
  it('prefers Account Adjustment by name among revaluation details', () => {
    expect(adjustmentCategoryIdFor(CATEGORIES)).toBe('cat-adjust');
  });

  it('falls back to any revaluation DETAIL when the name has been changed', () => {
    const renamed = CATEGORIES.filter((c) => c.id !== 'cat-adjust');
    expect(adjustmentCategoryIdFor(renamed)).toBe('cat-market');
  });

  it('never files under the type-level header — a row needs a detail category', () => {
    const typeOnly = CATEGORIES.filter((c) => c.level !== 'detail');
    expect(adjustmentCategoryIdFor(typeOnly)).toBeNull();
  });
});
