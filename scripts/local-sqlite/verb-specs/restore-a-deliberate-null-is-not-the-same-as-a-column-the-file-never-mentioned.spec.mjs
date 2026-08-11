import {
  USER, RESTORED_ROW, RESTORED_OTHER, RESTORED_ACCOUNT,
  asExportedBefore, backupTransaction, chunk, rowsInAccount, wipedWithOneAccount,
} from './_shared.mjs';

// The OTHER half of 20260811090000's rule, and the half that has a meaning to
// protect rather than a failure to avoid.
//
// `transactions.is_reconciled` (20260810200000) is NULLABLE ON PURPOSE, and the
// null MEANS something: *"this row predates the split between marking and
// committing; ask is_cleared"*. A cloud login's whole history carries it. So a
// restore that filled it in from the column default — as the absent case must be
// filled in — would report a decade of reconciled statements as work still
// outstanding, on the one operation there is no second copy of.
//
// Both branches are in one payload, and this spec is what CORRECTED the port:
// the first draft filled a silence from the column default wherever there was
// one, and the two engines disagreed here — 0 against NULL — which is the
// difference between "explicitly not committed" and "never asked". The cloud
// fills in exactly one class, *"NOT NULL WITH a default"*, and `is_reconciled`
// is nullable, so nothing reaches it on either engine now:
//
//   key ABSENT, nullable column       -> NULL. The past did not know, and this
//                                        column's NULL is how a ledger SAYS so.
//   key PRESENT null, nullable column -> NULL, deliberately.
//   either, on a NOT NULL column      -> the schema's own default (see
//                                        restore-a-column-the-file-predates-…).
export default {
  invariant: 'X-7',
  title: 'a column that may hold null is given what the file says, or null — never a default',
  design: '20260811090000 — "OMITTED IS NOT THE SAME AS NULL"; jsonb tells them apart with key presence and crate::backup asks the schema which columns may hold a null',
  consequence: 'a restored history filed as "marked, never committed" is every reconciliation the user has ever done, offered back to them to do again',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [
        // The pre-split row a cloud export really produces: the key is there and
        // it says null.
        backupTransaction({ is_reconciled: null }),
        // And the row from a file older than the column altogether.
        asExportedBefore(
          backupTransaction({ id: RESTORED_OTHER }),
          'is_reconciled',
        ),
      ])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 2 },
  state: [
    {
      name: 'the_third_value_survives',
      sqlite: `SELECT COALESCE(CAST(is_reconciled AS TEXT), 'NULL')
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT COALESCE(is_reconciled::text, 'NULL')
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: 'NULL',
    },
    {
      name: 'an_absent_key_on_a_nullable_column_is_also_null',
      sqlite: `SELECT COALESCE(CAST(is_reconciled AS TEXT), 'NULL')
                 FROM transactions WHERE id = '${RESTORED_OTHER}'`,
      postgres: `SELECT COALESCE(is_reconciled::text, 'NULL')
                   FROM public.transactions WHERE id = '${RESTORED_OTHER}'`,
      expect: 'NULL',
    },
    rowsInAccount(RESTORED_ACCOUNT, '2'),
  ],
};
