import {
  USER, EVERYDAY,
  balanceIdentityHolds, transferCategoriesFor, accountText, writeInstants,
} from './_shared.mjs';

// C-4, and the reason no verb implements it: both engines have the trigger, so
// the update writes one row and the file writes the second.
export default {
  invariant: 'C-4',
  title: 'renaming an account renames its To/From category, on both engines',
  design: 'trg_sync_transfer_category_for_account / sync_transfer_category_for_account (20260708140000:90-119)',
  consequence: 'a rename that left the old category name behind is what the migration was written to fix — every transfer already filed points at a category naming an account that no longer exists by that name',
  parity: 'match',

  command: {
    verb: 'update_account',
    payload: { id: EVERYDAY, user_id: USER, patch: { name: 'Everyday spending' } },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { id: EVERYDAY, name: 'Everyday spending' },

  state: [
    transferCategoriesFor(EVERYDAY, 'To/From Everyday spending:open'),
    accountText(EVERYDAY, 'name', 'Everyday spending'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
