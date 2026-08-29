import {
  USER, FED, aFeedCreatedAccount, storedBalances, balanceIdentityHolds, rowsInAccount,
} from './_shared.mjs';

// 20260829170000. To the table this account looks like a first import — no
// feed row anywhere in it — and the self-decide arm would REBASE. The caller
// says otherwise: `backfill: false` on every row, which is what chunk 2 of a
// split first sync looks like once the handler has asked the question for the
// whole sync. The stamp wins, the batch takes the incremental arm, and the
// opening figure does not move.
//
// This is the drift's own shape, inverted into correctness: before the stamp
// existed, a 469-row first sync rebased its first 200-row chunk and then
// moved the balance by the remaining chunks' sum — money the provider's
// snapshot already embodied, counted twice.
export default {
  invariant: 'B-4',
  title: 'a caller stamp outranks the account\'s own history',
  design: 'import_bank_transactions_atomic 20260829170000 — `r ? \'backfill\'` read before the table in the decision block',
  consequence: 'without it the RPC re-decides per 200-row chunk, and every first sync larger than one chunk drifts the balance by the later chunks\' sum',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'A', amount: '-12.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1',
          backfill: false },
        { user_id: USER, account_id: FED, description: 'B', amount: '-8.00',
          type: 'expense', date: '2024-05-02', external_transaction_id: 'n-2',
          backfill: false },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0 },

  state: [
    // Incremental despite the empty table: 100 + (−20) = 80, initial untouched.
    // The unstamped reading of this exact payload is pinned next door by
    // feed-the-rebase-is-decided-once-for-the-whole-batch: '100.00/120.00'.
    storedBalances(FED, '80.00/100.00'),
    rowsInAccount(FED, '2'),
    balanceIdentityHolds(FED),
  ],
};
