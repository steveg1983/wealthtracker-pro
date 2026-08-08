import {
  USER, EVERYDAY, SECOND_ACCOUNT, secondAccount, anAlreadyImportedRow, setups,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// The index is UNIQUE (user_id, import_source, import_source_id) — scoped by
// LOGIN, not by account — and that is a behaviour rather than a detail. Import a
// statement into the wrong account and you cannot repair it by re-posting the
// same chunk at the right one: every row is refused as a repeat and the second
// account stays empty.
//
// Recorded because the remedy is not obvious and the failure is silent: the call
// succeeds, reports `skipped`, and the account the user was looking at does not
// change.
export default {
  invariant: 'I-4',
  title: 'the same import key posted to a second account of the same login is skipped, not inserted',
  design: 'transactions_import_source_unique — UNIQUE (user_id, import_source, import_source_id); schema.sql:663 carries the same index, non-partial',
  consequence: 'a statement imported into the wrong account cannot be re-posted into the right one under its own keys, and the second attempt reports success having done nothing',
  parity: 'match',

  setup: setups(secondAccount, anAlreadyImportedRow),
  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: SECOND_ACCOUNT,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'fitid:1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 0, skipped: 1, idempotent: true },

  state: [
    rowsInAccount(SECOND_ACCOUNT, '0'),
    balanceOf(SECOND_ACCOUNT, '0.00'),
    balanceIdentityHolds(SECOND_ACCOUNT),
    balanceOf(EVERYDAY, '-29.25'),
    balanceIdentityHolds(EVERYDAY),
    auditTrail('NONE'),
  ],
};
