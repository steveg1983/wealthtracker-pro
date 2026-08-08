import { USER, EVERYDAY, WEEKLY_SHOP, auditRowsForCreate, auditRowsInTotal } from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000a7';

// U-1: "an operation cannot succeed without its audit entry, and vice versa"
// (20260610150000:5-7). Locally that is one SQLite transaction per verb.
//
// The `after` comparison is the part worth having. Both engines are asked for
// the amount as it appears IN THE AUDIT PAYLOAD, and both must say "-42.00" —
// which proves the payload is the STORED row rather than the request. Postgres
// gets that from `to_jsonb(v_tx)` on the RETURNING row; the Rust verb re-reads
// the row from storage for the same reason.
export default {
  invariant: 'U-1',
  title: 'a create writes exactly one audit row, in the same transaction, describing what storage holds',
  design: 'DESIGN.md §1.7 U-1; write_financial_audit at 20260808100000:177-179',
  consequence: 'no audit row means no answer to "what changed that figure" — the compliance gap the table exists to close',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Invented utility bill',
      amount: '-42.00',
      type: 'expense',
      date: '2024-03-02',
      category: WEEKLY_SHOP,
    },
  },

  expect: { outcome: 'ok' },

  state: [
    auditRowsForCreate(NEW_ROW, '1'),
    auditRowsInTotal('1'),
    {
      name: 'audit_names_the_user_who_owns_the_row',
      sqlite: `SELECT user_id FROM financial_audit_log WHERE entity_id = '${NEW_ROW}'`,
      postgres: `SELECT user_id::text FROM public.financial_audit_log WHERE entity_id = '${NEW_ROW}'`,
      expect: USER,
    },
    {
      name: 'audit_after_carries_the_stored_amount',
      // SQLite stores minor units, Postgres numeric — the audit payload is the
      // place they are made to agree, because both serialise money as a decimal
      // string rather than as a number.
      sqlite: `SELECT json_extract(after_data, '$.amount')
                 FROM financial_audit_log WHERE entity_id = '${NEW_ROW}'`,
      postgres: `SELECT after_data->>'amount'
                   FROM public.financial_audit_log WHERE entity_id = '${NEW_ROW}'`,
      expect: '-42.00',
    },
    {
      name: 'audit_after_carries_the_stored_description',
      sqlite: `SELECT json_extract(after_data, '$.description')
                 FROM financial_audit_log WHERE entity_id = '${NEW_ROW}'`,
      postgres: `SELECT after_data->>'description'
                   FROM public.financial_audit_log WHERE entity_id = '${NEW_ROW}'`,
      expect: 'Invented utility bill',
    },
  ],
};
