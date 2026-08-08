import { USER, THEIR_CATEGORY, MERGE_SOURCE, MERGE_TARGET, mergeablePair, secondUser,
  strangersCategory, setups, categoryShape, auditShape } from './_shared.mjs';

// X-6 through the same door as everywhere else in this crate: with an owner
// named, a category belonging to somebody else is INDISTINGUISHABLE from one
// that does not exist. Telling the two apart would confirm an id exists to a
// caller who may not see it, and it would do so through a function whose whole
// job is to delete things.
export default {
  invariant: 'X-6',
  title: 'a category belonging to somebody else reads as absent, not as forbidden',
  design: 'merge_categories 20260805214322:128-133 — WHERE id = … AND (p_user_id IS NULL OR user_id = p_user_id)',
  consequence: 'a mis-routed id merges away another login\'s category, and the refusal message confirms the id is real',
  parity: 'match',

  setup: setups(mergeablePair, secondUser, strangersCategory),
  command: { verb: 'merge_categories', payload: { source_id: THEIR_CATEGORY, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'category_not_found' },

  state: [
    categoryShape(THEIR_CATEGORY, 'Theirs:expense:detail:-:-:active'),
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    auditShape('NONE'),
  ],
};
