import { USER, MERGE_SOURCE, TO_FROM_RAINY_DAY, mergeablePair, namedTransferCategories,
  setups, categoryShape, auditShape } from './_shared.mjs';

// The consequence in the migration's own words: filing ordinary transactions
// against an account's To/From category "would invent transfers that never
// happened". T-6 resolves a transfer's category THROUGH this flag, so a shop
// receipt filed there is not merely mis-labelled — it starts reading as one side
// of a movement between two accounts.
export default {
  invariant: 'C-7',
  title: 'ordinary transactions cannot be filed into an account\'s transfer bookkeeping',
  design: 'merge_categories 20260805214322:183-186',
  consequence: 'a merge invents transfers that never happened, and the account\'s transfer report gains rows nobody made',
  parity: 'match',

  setup: setups(mergeablePair, namedTransferCategories),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: TO_FROM_RAINY_DAY, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_target_is_transfer_category' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    categoryShape(TO_FROM_RAINY_DAY, 'To/From Rainy day:both:detail:0001:t:active'),
    auditShape('NONE'),
  ],
};
