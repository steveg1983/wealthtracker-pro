import {
  USER, EVERYDAY,
  accountFlag, balanceOf, balanceIdentityHolds, rowsInAccount,
  transferCategoriesFor, writeInstants,
} from './_shared.mjs';

// What close MEANS, on both engines: one column, and the To/From category
// following it out of the dropdowns.
export default {
  invariant: 'C-4',
  title: 'closing an account hides it and its To/From category, and moves nothing',
  design: 'accountService.deleteAccount:338-372 — `.update({ is_active: false })` and nothing else; the category half is trg_sync_transfer_category_for_account (20260708140000:90-119)',
  consequence: 'a deleted account is a hole in a ledger — its transactions would have nowhere to belong — and the Close button promises the account can be reopened at any time',
  parity: 'match',

  command: {
    verb: 'close_account',
    payload: { id: EVERYDAY, user_id: USER },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { id: EVERYDAY, is_active: false, balance: '-25.00' },

  state: [
    accountFlag(EVERYDAY, 'is_active', 'no'),
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    transferCategoriesFor(EVERYDAY, 'To/From Everyday:hidden'),
  ],
};
