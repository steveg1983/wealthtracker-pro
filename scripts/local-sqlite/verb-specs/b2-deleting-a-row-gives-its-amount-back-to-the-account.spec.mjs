import {
  USER, EVERYDAY, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, rowExists, rowsInAccount,
  auditRowsForDelete, auditRowsInTotal,
} from './_shared.mjs';

// The delete verb's whole job, in one payload.
//
//     DELETE FROM public.transactions
//      WHERE id = p_id AND (p_user_id IS NULL OR user_id = p_user_id)
//     RETURNING * INTO v_old;
//     IF NOT FOUND THEN RAISE 'transaction_not_found'; END IF;
//
//     UPDATE public.accounts SET balance = balance - v_old.amount
//      WHERE id = v_old.account_id AND user_id = v_old.user_id;
//     IF NOT FOUND THEN RAISE 'account_not_found_or_not_owned'; END IF;
//
//     PERFORM public.write_financial_audit(
//       v_old.user_id, 'transaction', v_old.id, 'delete', to_jsonb(v_old), NULL);
//                                              -- 20260610150000:207-243
//
// `balance - amount`, relative, in SQL — the reversal, not a recomputation. The
// account started at -25.00 with exactly this row against it, so afterwards it
// holds nothing and is worth 0.00, and B-1 (`balance = initial + Σ`) says the
// same thing from the other end.
//
// The audit row is the one shape with a `before` and no `after`: U-6, and the
// local table's `audit_delete_has_no_after` CHECK enforces it. It is also the
// only surviving record that the row ever existed, which is why it commits in
// the same transaction as the delete rather than after it.
export default {
  invariant: 'B-2',
  title: 'deleting a row gives its amount back to the account, and leaves the audit row that says it existed',
  design: 'delete_transaction_atomic 20260610150000:207-243 — delete, reverse relatively, audit, all in one transaction',
  consequence: 'a delete that skipped the reversal would leave the balance holding money for a row nobody can see; B-1 would be broken with no visible cause',
  parity: 'match',

  command: {
    verb: 'delete_transaction',
    payload: { id: CORNER_SHOP, user_id: USER },
  },

  expect: { outcome: 'ok' },
  // The RPC returns the row it deleted, so the result is the row as it stood.
  result: { id: CORNER_SHOP, amount: '-25.00', description: 'Corner shop' },

  state: [
    rowExists(CORNER_SHOP, '0'),
    rowsInAccount(EVERYDAY, '0'),
    balanceOf(EVERYDAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    auditRowsForDelete(CORNER_SHOP, '1'),
    auditRowsInTotal('1'),
    {
      name: 'audit_before_carries_the_amount_that_was_reversed',
      sqlite: `SELECT json_extract(before_data, '$.amount') FROM financial_audit_log
                WHERE entity_id = '${CORNER_SHOP}'`,
      postgres: `SELECT before_data->>'amount' FROM public.financial_audit_log
                  WHERE entity_id = '${CORNER_SHOP}'`,
      expect: '-25.00',
    },
  ],
};
