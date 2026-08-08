import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, childOf, setups,
  categoryShape, auditShape } from './_shared.mjs';

// Same EXISTS, other side, different reason. Merging a leaf INTO a group is not
// destructive — it is just wrong: transactions belong to a detail category
// inside the group, and a total filed on the group itself double-counts against
// its own children in every roll-up.
export default {
  invariant: 'C-12',
  title: 'a group is not a category, it is what categories are inside',
  design: 'merge_categories 20260805214322:195-198',
  consequence: 'history is filed on a group and double-counts against its own children in every roll-up',
  parity: 'match',

  setup: setups(mergeablePair, childOf(MERGE_TARGET, 'c0000000-0000-0000-0000-0000000000c2')),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_target_is_group' },

  state: [
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:-:active'),
    categoryShape('c0000000-0000-0000-0000-0000000000c2', 'Underneath 00e2:expense:detail:00e2:-:active'),
    auditShape('NONE'),
  ],
};
