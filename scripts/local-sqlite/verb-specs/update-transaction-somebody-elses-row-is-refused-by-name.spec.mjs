import {
  USER, STRANGER, EVERYDAY, CORNER_SHOP,
  secondUser, balanceOf, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

// The IDOR guard, which arrived in a migration of its own because it had been
// missing. `20260612110000_update_transaction_atomic_user_scope.sql:1-6`:
// "Defence-in-depth IDOR guard ... delete_transaction_atomic additionally
// [scoped by user]; update_transaction_atomic did not, leaving the two paths
// inconsistent."
//
//     SELECT * INTO v_old FROM public.transactions
//      WHERE id = p_id AND (p_user_id IS NULL OR user_id = p_user_id)
//      FOR UPDATE;
//     IF NOT FOUND THEN RAISE 'transaction_not_found'; END IF;
//                                                      -- 20260808100000:295-303
//
// The refusal is `transaction_not_found` and NOT something like
// `not_your_transaction`, deliberately: telling a caller that an id exists but
// belongs to somebody else confirms the id to somebody who may not see it. The
// two cases are one message on purpose, and a port that "improved" the message
// would leak exactly what the migration was written to stop leaking.
//
// The local file has no RLS, so this clause is the ONLY thing standing between
// the caller and the row — which makes it more load-bearing locally than in the
// cloud, not less.
export default {
  invariant: 'X-6',
  title: "editing somebody else's row is refused by name, and refused the same way as a row that does not exist",
  design: '20260612110000:1-6 (why the guard exists) and 20260808100000:295-303 (the scoped SELECT it became)',
  consequence: 'without the ownership clause a caller who guesses an id edits another user\'s money; with a DIFFERENT message for it, they learn which ids are real',
  parity: 'match',

  setup: secondUser,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      // The row belongs to USER. This caller does not.
      user_id: STRANGER,
      patch: { amount: '-1.00', description: 'not mine to edit' },
    },
  },

  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    {
      name: 'the_row_is_untouched',
      sqlite: `SELECT description FROM transactions WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT description FROM public.transactions WHERE id = '${CORNER_SHOP}'`,
      expect: 'Corner shop',
    },
    {
      name: 'and_it_still_belongs_to_its_owner',
      sqlite: `SELECT user_id FROM transactions WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT user_id::text FROM public.transactions WHERE id = '${CORNER_SHOP}'`,
      expect: USER,
    },
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    // A refusal writes no audit row. The log records operations that happened.
    auditRowsInTotal('0'),
  ],
};
