import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// One call = one database transaction, and this is the assertion that proves it
// rather than restating it. The first row is perfectly good and is INSERTED
// before the second one fails; what makes the account whole again is the
// rollback, not a check.
//
// MEASURED on the reference cluster: rows back to 1, balance back to its opening
// figure, audit log empty. Both engines refuse and word it differently — the
// cloud's boolean cast against a named local refusal — which is why the outcome
// is what parity is computed from and the message is declared per engine.
export default {
  invariant: 'U-1',
  title: 'a row the ledger cannot store takes back the rows that already landed ahead of it',
  design: 'import_transactions_atomic 20260709120000:10-12 — "One call = one database transaction: every insert + the single balance effect + the audit rows commit together or not at all"',
  consequence: 'a half-applied import is a register the user has to reconcile by hand against a file, with no record of where it stopped',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Good', amount: '-1.00', type: 'expense', date: '2024-05-01' },
        { description: 'Bad', amount: '-1.00', type: 'expense', date: '2024-05-01', category_confirmed: 'banana' },
      ],
    },
  },

  expect: {
    postgres: { outcome: 'refused', error: 'invalid input syntax for type boolean' },
    sqlite: { outcome: 'refused', error: 'boolean_invalid' },
  },

  state: [
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditTrail('NONE'),
  ],
};
