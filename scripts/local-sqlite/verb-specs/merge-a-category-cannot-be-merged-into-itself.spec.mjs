import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair,
  categoryShape, auditShape, balanceIdentityHolds, EVERYDAY } from './_shared.mjs';

// Second in the order, and MEASURED to beat the lookup: naming an id that does
// not exist TWICE reports `merge_source_is_target`, not `category_not_found`
// (probe-merge2.sh, o1). A caller who has managed to select one category as both
// sides is told what they did, rather than being sent looking for a missing row.
export default {
  invariant: 'C-13',
  title: 'the same category on both sides is refused before either is looked up',
  design: 'merge_categories 20260805214322:115-118 — checked before the FOR UPDATE lock',
  consequence: 'a self-merge reaches the loops, moves every reference onto itself, and then deletes the category it just filed everything under',
  parity: 'match',

  setup: mergeablePair,
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_SOURCE, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_source_is_target' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
