import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair,
  categoryShape, auditShape } from './_shared.mjs';

// The other half of the pair. Same code, different branch, and the branch is
// what matters: a port that read only the source and assumed the target would
// resolve later would pass the previous spec and delete a category into nothing.
export default {
  invariant: 'C-13',
  title: 'a target category that is not there is refused before the source is touched',
  design: 'merge_categories 20260805214322:135-140 — the second SELECT INTO, HINT "merged into"',
  consequence: 'the source is deleted and its history is filed under an id that resolves to nothing',
  parity: 'match',

  setup: mergeablePair,
  command: {
    verb: 'merge_categories',
    payload: { source_id: MERGE_SOURCE, target_id: 'c0000000-0000-0000-0000-0000000000ff', user_id: USER },
  },
  expect: { outcome: 'refused', error: 'category_not_found' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    auditShape('NONE'),
  ],
};
