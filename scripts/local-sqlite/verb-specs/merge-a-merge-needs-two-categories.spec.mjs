import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair,
  categoryShape, auditShape, balanceIdentityHolds, EVERYDAY } from './_shared.mjs';

// The first line of the function, and the only refusal reachable before anything
// is opened. `p_source_id IS NULL OR p_target_id IS NULL` — so the local command
// carries `Option` fields rather than `String` ones, because a deserialiser that
// demanded both would turn a NAMED refusal into `invalid_command` and the two
// editions would disagree about what went wrong.
export default {
  invariant: 'C-13',
  title: 'a merge with only one category named is refused before anything is read',
  design: 'merge_categories 20260805214322:111-114 — the first RAISE, before the lock',
  consequence: 'a half-specified merge reaches the lookup and reports "category not found" for a category nobody asked about',
  parity: 'match',

  setup: mergeablePair,
  command: { verb: 'merge_categories', payload: { source_id: null, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_needs_two_categories' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:-:active'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
