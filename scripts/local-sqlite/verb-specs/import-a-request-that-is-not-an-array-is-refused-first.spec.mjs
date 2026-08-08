import {
  USER, SOMEONE_ELSES_ACCOUNT, secondUser, accountExists, rowsInAccount, auditTrail,
} from './_shared.mjs';

// Refusal 1 of 5, and it is first even against an account the caller has no
// business in — MEASURED with both faults true at once. A caller sending
// nonsense learns that the nonsense is the problem.
export default {
  invariant: 'I-4',
  title: 'a rows payload that is not an array is refused before anything else is looked at',
  design: 'import_transactions_atomic 20260808140000:264-266 — the first statement in the body',
  consequence: 'a caller that sends the wrong shape is told about the wrong problem, or is told nothing and imports an empty file',
  parity: 'match',

  setup: secondUser,
  command: {
    verb: 'import_transactions',
    payload: { user_id: USER, account_id: SOMEONE_ELSES_ACCOUNT, rows: 'nope' },
  },

  expect: { outcome: 'refused', error: 'p_rows must be a jsonb array' },

  state: [
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    rowsInAccount(SOMEONE_ELSES_ACCOUNT, '0'),
    auditTrail('NONE'),
  ],
};
