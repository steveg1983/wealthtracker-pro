import {
  USER, SOMEONE_ELSES_ACCOUNT, secondUser, accountExists, balanceIdentityHolds,
  rowsInAccount, auditTrail,
} from './_shared.mjs';

// The security boundary of this function, and the whole of it: the service role
// bypasses RLS, so `p_user_id` + the ownership check ARE the check. The account
// here demonstrably exists, so only the ownership half of the predicate can be
// what refused — the sibling spec above pins the ORDER this one sits at the end
// of.
export default {
  invariant: 'R-12',
  title: 'an import aimed at somebody else\'s account is refused, and nothing is written',
  design: 'import_transactions_atomic 20260808140000:310-320 — the lock and ownership check that "is the security boundary"',
  consequence: 'without it a caller with a valid session writes a statement into a stranger\'s account and moves their balance',
  parity: 'match',

  setup: secondUser,
  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: SOMEONE_ELSES_ACCOUNT,
      rows: [{ description: 'A', amount: '-1.00', type: 'expense', date: '2024-05-01' }],
    },
  },

  expect: { outcome: 'refused', error: 'account_not_found_or_not_owned' },

  state: [
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    rowsInAccount(SOMEONE_ELSES_ACCOUNT, '0'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    auditTrail('NONE'),
  ],
};
