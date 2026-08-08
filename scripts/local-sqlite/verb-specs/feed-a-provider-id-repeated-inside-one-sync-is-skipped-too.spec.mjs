import {
  USER, FED, aFeedCreatedAccount, storedBalances, balanceIdentityHolds, rowsInAccount,
} from './_shared.mjs';

// The dedupe reads the TABLE, and rows inserted earlier in the same call are in
// it, so the second copy of a provider id inside one request is skipped by the
// same test that catches a re-sync. Measured rather than assumed, because the
// ON CONFLICT clause below it CANNOT do this job: connection_id is NULL here and
// NULLs never conflict.
export default {
  invariant: 'I-1',
  title: 'a provider id repeated inside one sync is caught by the same test that catches a re-sync',
  design: 'import_bank_transactions_atomic 20260808100000:604-611 — an EXISTS against the table, which sees this call\'s own inserts',
  consequence: 'a provider that lists a transaction twice in one page would import it twice, and the balance would move twice for one payment',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'A', amount: '-10.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
        { user_id: USER, account_id: FED, description: 'B', amount: '-3.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 1 },

  state: [
    rowsInAccount(FED, '1'),
    storedBalances(FED, '100.00/110.00'),
    balanceIdentityHolds(FED),
  ],
};
