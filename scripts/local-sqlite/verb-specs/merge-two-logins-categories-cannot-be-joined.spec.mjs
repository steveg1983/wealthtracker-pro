import { THEIR_CATEGORY, MERGE_SOURCE, mergeablePair, secondUser, strangersCategory,
  setups, categoryShape, auditShape } from './_shared.mjs';

// The ONE refusal in this function with no machine code — the cloud raises the
// bare sentence "categories belong to different users" (ERRCODE 28000) where
// every other RAISE here is `code: sentence`. The client surfaces error.message
// verbatim, so that sentence is what a human sees, and it is carried over
// unimproved: a better message would make the two editions say different things
// about the same event.
//
// Reachable ONLY with no owner named. With p_user_id supplied both lookups are
// already scoped and a foreign row reads as absent — which is the previous spec.
export default {
  invariant: 'X-6',
  title: 'with no owner named, two logins\' categories are refused rather than joined',
  design: 'merge_categories 20260805214322:142-145 — the un-coded RAISE, ERRCODE 28000',
  consequence: 'a service-role or migration call with no owner argument merges one login\'s history into another\'s category',
  parity: 'match',

  setup: setups(mergeablePair, secondUser, strangersCategory),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: THEIR_CATEGORY } },
  expect: { outcome: 'refused', error: 'categories belong to different users' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    categoryShape(THEIR_CATEGORY, 'Theirs:expense:detail:-:-:active'),
    auditShape('NONE'),
  ],
};
