import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, childOf, setups,
  categoryShape, auditShape } from './_shared.mjs';

// The refusal ORDER, as a cross-engine contract rather than as a local unit
// test. Both sides are wrong at once — the source is a group and so is the
// target — and both engines must name the SOURCE.
//
// This spec exists because a deliberate mutation found the gap: swapping
// `refuse_bad_source` and `refuse_bad_target` in the Rust left all twenty-eight
// other merge specs GREEN, because not one of them made a source guard and a
// target guard true at the same time. The order is part of what the user is
// told — "fix this end first" — and an order that only one engine has is a
// divergence nobody would notice until two people compared screenshots.
export default {
  invariant: 'C-13',
  title: 'when both categories are groups, the one being merged AWAY is named',
  design: 'merge_categories 20260805214322:147-198 — the five source guards, then the five target ones; measured pairwise in probe-merge2.sh o9',
  consequence: 'the two editions blame opposite ends of the same mistake, and the remedy each offers fixes the other one\'s complaint',
  parity: 'match',

  setup: setups(
    mergeablePair,
    childOf(MERGE_SOURCE),
    childOf(MERGE_TARGET, 'c0000000-0000-0000-0000-0000000000c2'),
  ),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_source_has_children' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:-:active'),
    auditShape('NONE'),
  ],
};
