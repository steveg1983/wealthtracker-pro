import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, OPENING_BALANCE, SOMEONE_ELSES_ACCOUNT,
  setups, secondUser, enriched,
  balanceOf, balanceIdentityHolds, auditRowsInTotal, accountExists, storedAmount,
} from './_shared.mjs';

// THE SAME HOLE ON THE EDIT PATH, WHICH IS THE ONE A USER ACTUALLY WALKS.
//
// `update_transaction_atomic` carries `transfer_account_id` in its allow-list
// (20260808100000:325-327) and, like the create path, applies no ownership test
// to it at all. So an ordinary edit of an ordinary row could re-point the far
// side of a transfer at an account the caller does not own — and unlike a raw
// insert, this is a path with a button on it.
//
// MEASURED on the reference cluster (probe-fk-verbs.sql, P4): ACCEPTED before
// 20260808170000, refused by `transactions_transfer_account_id_user_fkey`
// after. Both engines now refuse for the same reason and word it their own way.
//
// THE CONTROL IS THE FIXTURE. `enriched` gives the Corner shop row a far side
// already — Rainy day, an account of the caller's own — so the column
// demonstrably takes a target on this row, through this verb's own allow-list.
// The state assertion reads it back unchanged: the refused patch moved nothing,
// and what it failed to move it failed to move because of WHOSE account it
// named.
export default {
  invariant: 'R-12',
  title: 'an edit may not re-point the far side of a transfer at an account belonging to another login',
  design: 'transactions_transfer_account_id_user_fkey (20260808170000:456-463) against update_transaction_atomic 20260808100000:325-327, which passes the column through unchecked',
  consequence: 'an ordinary edit files a stranger\'s account as the other end of a movement, and every later reader of that row follows the link into a ledger this login has no part in',
  parity: 'match',

  setup: setups(secondUser, enriched),

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { transfer_account_id: SOMEONE_ELSES_ACCOUNT },
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
    postgres: { outcome: 'refused', error: 'transactions_transfer_account_id_user_fkey' },
  },

  state: [
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    {
      // The control, read back: the far side the fixture set — an account of
      // the caller's own — is still there and unchanged.
      name: 'the_far_side_of_your_own_is_untouched',
      sqlite: `SELECT COALESCE(transfer_account_id, 'CLEARED') FROM transactions
                WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT COALESCE(transfer_account_id::text, 'CLEARED') FROM public.transactions
                  WHERE id = '${CORNER_SHOP}'`,
      expect: RAINY_DAY,
    },
    storedAmount(CORNER_SHOP, '-25.00'),
    balanceOf(EVERYDAY, OPENING_BALANCE),
    balanceIdentityHolds(EVERYDAY),
    // A refusal writes no audit row. The log records operations that happened.
    auditRowsInTotal('0'),
  ],
};
