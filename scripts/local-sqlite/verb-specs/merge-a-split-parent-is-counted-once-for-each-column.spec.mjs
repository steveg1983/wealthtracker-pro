import { USER, MERGE_SOURCE, MERGE_TARGET, CORNER_SHOP, EVERYDAY, mergeablePair,
  splitParentUnderTheSource, setups, categoryShape, filedAs, splitLines,
  splitSumHolds, auditRowsInTotal, auditShape, referencesTo,
  balanceOf, balanceIdentityHolds } from './_shared.mjs';

// The shape that proves the CASE is load-bearing. A split parent's `category` is
// blank BY DESIGN and trg_protect_split_category (S-5) refuses any update that
// gives a split parent one — so the loop's
// `CASE WHEN category = source THEN target ELSE category END` is what lets the
// row's `category_id` move at all. MEASURED both ways: the same UPDATE without
// the CASE is refused with `split_category_locked`.
//
// And the outcome that looks wrong and is not: this ONE row is counted by the
// transactions loop AND by the lines loop, and audited twice. Two different
// facts about two different columns; a port that deduplicated them would report
// a smaller number than the cloud for the same merge.
export default {
  invariant: 'S-5',
  title: 'a split parent moves through its uuid column and its line, and is audited for each',
  design: 'merge_categories 20260805214322:213-217 (the CASE) and :242-289 (lines audited on the parent)',
  consequence: 'the merge trips the split guard and dies, or the CASE is dropped and a split parent silently acquires a category',
  parity: 'match',

  setup: setups(mergeablePair, splitParentUnderTheSource),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, category: '', category_id: MERGE_TARGET, is_split: true },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    filedAs(CORNER_SHOP, 'EMPTY/Groceries'),
    splitLines(CORNER_SHOP, '0:-15.00:Groceries:-:-:- | 1:-10.00:Weekly shop:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    referencesTo(MERGE_SOURCE, '0'),
    // One category delete, and TWO transaction updates for one transaction.
    auditShape('category/delete,transaction/update,transaction/update'),
    auditRowsInTotal('3'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
