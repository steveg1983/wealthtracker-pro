import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, rowsInAccount, auditTrail, importedRow,
} from './_shared.mjs';

// The shape every file import in the app takes: one call, N rows, ONE balance
// movement. `20260709120000:5-8` is the defect it was written for — the browser
// used to fire one un-awaited RPC per row, and "most rows silently failed".
//
// The audit trail is asserted in WRITE ORDER rather than sorted, because the
// order is part of the contract: the rows are recorded as they land and the
// account movement closes the batch. A port that moved the balance per row would
// still produce the right total and the wrong log.
export default {
  invariant: 'B-2',
  title: 'a chunk of rows lands together and moves the balance exactly once',
  design: 'import_transactions_atomic 20260808140000:322-387 — the loop, then a single balance = balance + v_sum guarded by IF v_inserted > 0',
  consequence: 'a per-row balance movement is N audit rows for one event, and any failure halfway leaves a balance that agrees with nothing',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01', statement_sequence: 1 },
        { description: 'Bus', amount: '-2.50', type: 'expense', date: '2024-05-01', statement_sequence: 2 },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0, idempotent: false },

  state: [
    rowsInAccount(EVERYDAY, '3'),
    balanceOf(EVERYDAY, '-31.75'),
    balanceIdentityHolds(EVERYDAY),
    importedRow('Coffee', '- | confirmed=yes | cleared=no | seq=1'),
    importedRow('Bus', '- | confirmed=yes | cleared=no | seq=2'),
    auditTrail('transaction/create,transaction/create,account/update'),
  ],
};
