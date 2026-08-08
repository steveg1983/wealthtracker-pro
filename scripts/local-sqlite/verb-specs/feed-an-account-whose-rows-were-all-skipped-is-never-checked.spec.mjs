import {
  USER, SOMEONE_ELSES_ACCOUNT, aStrangersFedAccount,
  accountExists, rowsInAccount, balanceIdentityHolds, auditTrail,
} from './_shared.mjs';

// THE HOLE, measured and reproduced rather than quietly closed.
//
// The ownership check lives in the SECOND loop, which visits only accounts that
// actually received a row. If every row for an account is skipped by the dedupe,
// that account is never looked at — so a caller learns that a given (account,
// provider id) pair already exists in somebody else's register, and is told
// `skipped` rather than refused.
//
// It is not fixed here for the reason merge_categories gives about what it
// leaves behind: a local port that closed it would do something the cloud does
// not, and the two would stop being implementations of one verb. In the cloud
// the exposure is bounded by the function being service-role only with exactly
// one caller (api/banking/sync-transactions.ts). Recorded so that nobody has to
// rediscover it, and so that closing it is a decision rather than an accident.
export default {
  invariant: 'R-12',
  title: 'an account whose rows were all skipped is never checked for ownership at all',
  design: 'import_bank_transactions_atomic 20260808100000:688-698 — the FOR loop over v_sums, which only holds accounts that received a row',
  consequence: 'a caller can ask "does this account already hold this provider id" of an account it does not own, and be answered',
  parity: 'match',

  setup: aStrangersFedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: SOMEONE_ELSES_ACCOUNT, description: 'Shop', amount: '-1.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  // Accepted. Nothing is written — but nothing refuses either, and the answer
  // is informative.
  expect: { outcome: 'ok' },
  result: { inserted: 0, skipped: 1 },

  state: [
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    rowsInAccount(SOMEONE_ELSES_ACCOUNT, '1'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    auditTrail('NONE'),
  ],
};
