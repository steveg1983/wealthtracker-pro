import {
  USER, EVERYDAY, TO_FROM_EVERYDAY, namedTransferCategories,
  balanceIdentityHolds, categoriesOwnedBy, transferCategoryCount,
} from './_shared.mjs';

// C-5, straight down the middle. A To/From category is system bookkeeping for
// its account and neither engine will let one go while the account is there.
// The verb does not pre-check it — the protection belongs to the schema in both
// editions, and a second implementation of it is a second thing to keep in step.
export default {
  invariant: 'C-7',
  title: 'an account’s To/From category cannot be deleted while the account is there',
  design: 'C-5 — protect_transfer_category (20260708140000:127-146) and its port trg_protect_transfer_category, BEFORE DELETE ON categories',
  consequence: 'deleting it would leave every transfer into or out of that account filed under a category that no longer exists, and the account would go on offering transfers with nowhere to file them',
  parity: 'match',

  setup: namedTransferCategories,

  command: {
    verb: 'delete_category',
    payload: { id: TO_FROM_EVERYDAY, user_id: USER },
  },

  // The trigger's own word, on both engines, and it is the whole message a user
  // sees: SQLite's RAISE carries one string and the cloud's HINT is dropped by
  // handleSupabaseError, so the two editions say the same thing.
  expect: { outcome: 'refused', error: 'transfer_category_protected' },

  state: [
    transferCategoryCount('2'),
    categoriesOwnedBy(USER, '5'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
