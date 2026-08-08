import {
  USER, EVERYDAY, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, auditRowsForUpdate, auditRowsInTotal,
} from './_shared.mjs';

// U-1 on the edit path. `20260610150000:5-7`: "Written from INSIDE the atomic
// transaction RPCs, so the audit row commits in the same database transaction as
// the operation it records: an operation cannot succeed without its audit entry,
// and vice versa."
//
// An update's audit row is the one that carries BOTH sides —
//
//     PERFORM public.write_financial_audit(
//       v_new.user_id, 'transaction', v_new.id, 'update',
//       to_jsonb(v_old), to_jsonb(v_new));            -- 20260808100000:369-371
//
// — and `before` is the half that makes the log evidence rather than a duplicate
// of the current row. A port that logged only `after` would produce an audit
// trail that cannot answer the one question an audit trail exists for: what was
// it before somebody changed it?
//
// Both halves are asserted to be what STORAGE held, not what the caller sent:
// the cloud serialises `v_old`/`v_new`, which are RETURNING rows, and the local
// port reads the row back from the file on both sides for the same reason.
export default {
  invariant: 'U-1',
  title: 'an edit writes exactly one audit row, in the same transaction, carrying the old row and the new one',
  design: '20260610150000:5-7 (the U-1 statement) and 20260808100000:369-371 (the call this verb makes)',
  consequence: 'an audit trail without the before is a list of current values; the one question it exists to answer — what was this before it was changed — becomes unanswerable',
  parity: 'match',

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { description: 'Invented corner shop, renamed', amount: '-30.00' },
    },
  },

  expect: { outcome: 'ok' },
  result: { description: 'Invented corner shop, renamed', amount: '-30.00' },

  state: [
    auditRowsForUpdate(CORNER_SHOP, '1'),
    // One row for one edit. Two would mean the port audited the balance move
    // separately, which the single-row RPCs deliberately do not (only the bulk
    // importers audit an account row, because their balance move is a batch).
    auditRowsInTotal('1'),
    {
      name: 'audit_names_the_user_who_owns_the_row',
      sqlite: `SELECT user_id FROM financial_audit_log WHERE entity_id = '${CORNER_SHOP}'`,
      postgres: `SELECT user_id::text FROM public.financial_audit_log WHERE entity_id = '${CORNER_SHOP}'`,
      expect: USER,
    },
    {
      // What it was. Read out of the JSON so the shape is asserted too, and
      // spelled with the money AS A STRING on both engines — the local edition
      // serialises Money as "-25.00" and Postgres's numeric casts to the same
      // text, so neither side goes through a float to be compared.
      name: 'audit_before_carries_the_amount_it_had',
      sqlite: `SELECT json_extract(before_data, '$.amount') FROM financial_audit_log
                WHERE entity_id = '${CORNER_SHOP}'`,
      postgres: `SELECT before_data->>'amount' FROM public.financial_audit_log
                  WHERE entity_id = '${CORNER_SHOP}'`,
      expect: '-25.00',
    },
    {
      name: 'audit_after_carries_the_amount_it_has',
      sqlite: `SELECT json_extract(after_data, '$.amount') FROM financial_audit_log
                WHERE entity_id = '${CORNER_SHOP}'`,
      postgres: `SELECT after_data->>'amount' FROM public.financial_audit_log
                  WHERE entity_id = '${CORNER_SHOP}'`,
      expect: '-30.00',
    },
    {
      name: 'audit_before_carries_the_description_it_had',
      sqlite: `SELECT json_extract(before_data, '$.description') FROM financial_audit_log
                WHERE entity_id = '${CORNER_SHOP}'`,
      postgres: `SELECT before_data->>'description' FROM public.financial_audit_log
                  WHERE entity_id = '${CORNER_SHOP}'`,
      expect: 'Corner shop',
    },
    balanceOf(EVERYDAY, '-30.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
