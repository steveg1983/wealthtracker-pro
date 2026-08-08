import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, childOf, setups,
  categoryShape, auditShape } from './_shared.mjs';

// v1 is leaf-to-leaf. `categories.parent_id` is ON DELETE CASCADE (C-12), so a
// merge that allowed a group would take the group's children with it after
// moving only the group's own references — the children's transactions would be
// left pointing at ids that no longer resolve.
//
// MEASURED and worth knowing: the EXISTS is not scoped by owner, so a child
// belonging to somebody else also refuses the merge (probe-merge3.sh, e5). That
// is the safe direction, and a "tidier" scoped port would cascade a stranger's
// category away.
export default {
  invariant: 'C-12',
  title: 'a category with categories under it is refused rather than half-merged',
  design: 'merge_categories 20260805214322:173-176 — EXISTS (SELECT 1 FROM categories WHERE parent_id = source)',
  consequence: 'the subtree cascades away with its parent and every transaction under it loses its filing',
  parity: 'match',

  setup: setups(mergeablePair, childOf(MERGE_SOURCE)),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_source_has_children' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    categoryShape('c0000000-0000-0000-0000-0000000000c1', 'Underneath 00e1:expense:detail:00e1:-:active'),
    auditShape('NONE'),
  ],
};
