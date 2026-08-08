import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair,
  categoryShape, auditShape } from './_shared.mjs';

// The two `category_not_found` raises differ only in HINT, and the HINT is the
// only thing telling the user WHICH category they can no longer see. SQLERRM
// carries the message and not the hint, so the harness holds both engines to the
// code; the hints themselves were measured verbatim (probe-merge2.sh, o2b/o2c)
// and are carried into the Rust refusal.
export default {
  invariant: 'C-13',
  title: 'a source category that is not there is refused by name',
  design: 'merge_categories 20260805214322:128-133 — SELECT INTO, IF NOT FOUND, HINT "merged away"',
  consequence: 'a stale Categories page merges into a category that is already gone and the user is told nothing useful',
  parity: 'match',

  setup: mergeablePair,
  command: {
    verb: 'merge_categories',
    payload: { source_id: 'c0000000-0000-0000-0000-0000000000ff', target_id: MERGE_TARGET, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'category_not_found' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:-:active'),
    auditShape('NONE'),
  ],
};
