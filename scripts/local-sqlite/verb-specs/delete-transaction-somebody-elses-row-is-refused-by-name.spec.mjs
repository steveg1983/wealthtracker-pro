import {
  USER, STRANGER, EVERYDAY, CORNER_SHOP,
  secondUser, balanceOf, balanceIdentityHolds, rowExists, auditRowsInTotal,
} from './_shared.mjs';

// The ownership gate on the delete path. Unlike update's, this one was in the
// RPC from the first day — `20260612110000:4` says so while explaining that
// update's was not: "delete_transaction_atomic additionally [scoped by user];
// update_transaction_atomic did not, leaving the two paths inconsistent."
//
//     DELETE FROM public.transactions
//      WHERE id = p_id AND (p_user_id IS NULL OR user_id = p_user_id)
//     RETURNING * INTO v_old;
//     IF NOT FOUND THEN RAISE 'transaction_not_found'; END IF;
//                                                      -- 20260610150000:218-225
//
// The consequence of losing it is worse here than on the update path. A wrongly
// scoped update writes something recoverable; a wrongly scoped delete removes
// another user's row AND takes their balance with it, and the only surviving
// evidence is an audit entry filed under the wrong owner.
//
// Same message as "no such row", for the same reason as the update verb: a
// distinct refusal would confirm to a caller that an id they cannot see is real.
export default {
  invariant: 'X-6',
  title: "deleting somebody else's row is refused by name, and nothing at all happens",
  design: 'delete_transaction_atomic 20260610150000:218-225 — the scope clause is part of the DELETE, not a check before it',
  consequence: "a delete that ignored the owner removes another user's transaction and their balance with it; there is no undo and the audit row would be filed under the wrong person",
  parity: 'match',

  setup: secondUser,

  command: {
    verb: 'delete_transaction',
    payload: { id: CORNER_SHOP, user_id: STRANGER },
  },

  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    rowExists(CORNER_SHOP, '1'),
    {
      name: 'and_it_still_belongs_to_its_owner',
      sqlite: `SELECT user_id FROM transactions WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT user_id::text FROM public.transactions WHERE id = '${CORNER_SHOP}'`,
      expect: USER,
    },
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
