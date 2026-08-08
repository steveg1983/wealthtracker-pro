import { USER, OUTGOINGS, MERGE_SOURCE, mergeablePair, categoryShape, auditShape } from './_shared.mjs';

// The target side of C-2, and it needs its own spec because it is a different
// branch reached after all five source guards have passed. Filing transactions
// against a heading would put them in a place no report reads from — the
// category tree renders type rows as sections, not as destinations.
export default {
  invariant: 'C-2',
  title: 'a top-level heading is not somewhere transactions can be filed',
  design: 'merge_categories 20260805214322:179-182 — the first of the five target guards',
  consequence: 'history is filed against a section heading and disappears from every by-category report',
  parity: 'match',

  setup: mergeablePair,
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: OUTGOINGS, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_target_is_type_root' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    categoryShape(OUTGOINGS, 'Outgoings:expense:type:-:-:active'),
    auditShape('NONE'),
  ],
};
