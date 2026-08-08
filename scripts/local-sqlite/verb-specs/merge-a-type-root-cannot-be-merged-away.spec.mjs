import { USER, OUTGOINGS, MERGE_TARGET, mergeablePair, categoryShape, auditShape } from './_shared.mjs';

// C-2: `level` is enumerated, and a `type` row is a HEADING. Nothing is filed
// against one, so merging one away would move nothing and delete the top of a
// branch — taking every category under it with it, because parent_id cascades.
export default {
  invariant: 'C-2',
  title: 'a top-level heading is not a category things are filed under',
  design: 'merge_categories 20260805214322:148-151 — the first of the five source guards',
  consequence: 'merging a type root cascades its entire subtree away and reports "0 transactions moved" while doing it',
  parity: 'match',

  setup: mergeablePair,
  command: { verb: 'merge_categories', payload: { source_id: OUTGOINGS, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_source_is_type_root' },

  state: [
    categoryShape(OUTGOINGS, 'Outgoings:expense:type:-:-:active'),
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:-:active'),
    auditShape('NONE'),
  ],
};
