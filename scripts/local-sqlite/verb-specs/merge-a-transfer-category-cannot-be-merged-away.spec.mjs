import { USER, MERGE_TARGET, TO_FROM_EVERYDAY, mergeablePair, namedTransferCategories,
  setups, categoryShape, auditShape } from './_shared.mjs';

// C-5 arrives at the same answer from two directions, and the ORDER is what
// matters. The schema's trg_protect_transfer_category would refuse the DELETE at
// the end of the merge anyway — but by then every reference has already moved,
// and the refusal would be the file catching a verb that should never have got
// that far. This guard is what makes the DELETE's protection unreachable through
// this path, which is why the guard order is written down rather than assumed.
export default {
  invariant: 'C-7',
  title: 'an account\'s To/From category cannot be merged away',
  design: 'merge_categories 20260805214322:152-155; the DELETE it makes unreachable is 20260708140000:127-146',
  consequence: 'an account loses its transfer bookkeeping and every transfer filed under it resolves to nothing',
  parity: 'match',

  setup: setups(mergeablePair, namedTransferCategories),
  command: { verb: 'merge_categories', payload: { source_id: TO_FROM_EVERYDAY, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_source_is_transfer_category' },

  state: [
    categoryShape(TO_FROM_EVERYDAY, 'To/From Everyday:both:detail:0001:t:active'),
    auditShape('NONE'),
  ],
};
