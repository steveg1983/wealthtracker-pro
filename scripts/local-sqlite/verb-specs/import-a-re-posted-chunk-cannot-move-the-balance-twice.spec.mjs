import {
  USER, EVERYDAY, anAlreadyImportedRow,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// THE HEADLINE of 20260808140000, and the failure it was written to end:
//
//   "If the request COMMITS and the response is then lost — a Vercel gateway
//    timeout, a dropped connection, a phone changing network — the browser
//    cannot tell that from a request that never arrived. Post it again and the
//    same thousand rows insert a second time and `balance = balance + v_sum`
//    runs a second time. […] Silent, permanent double-counting of real money,
//    in the register AND in the balance."
//
// The setup IS the first POST: the row is there under its key and the balance
// has already moved. The command is the browser trying again.
export default {
  invariant: 'I-4',
  title: 'a chunk posted twice inserts nothing the second time and the balance does not move again',
  design: 'import_transactions_atomic 20260808140000:355-363 — ON CONFLICT (user_id, import_source, import_source_id) DO NOTHING, and the CONTINUE that keeps a refused row out of v_sum',
  consequence: 'a lost response becomes a duplicated statement and a permanently wrong balance, with nothing anywhere to object',
  parity: 'match',

  setup: anAlreadyImportedRow,
  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'fitid:1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  // `idempotent` is TRUE on a request that inserted nothing: it describes the
  // request's keys, not its effect.
  result: { inserted: 0, skipped: 1, idempotent: true },

  state: [
    rowsInAccount(EVERYDAY, '2'),
    balanceOf(EVERYDAY, '-29.25'),
    balanceIdentityHolds(EVERYDAY),
    // A refused row writes no audit entry, and with nothing inserted there is no
    // balance movement to audit either. The log keeps saying what the table holds.
    auditTrail('NONE'),
  ],
};
