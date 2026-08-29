import {
  USER, FED, aFeedAccountWithHistory, storedBalances, balanceIdentityHolds, rowsInAccount,
} from './_shared.mjs';

// The other direction of the stamp, so the pair proves it is READ rather than
// one arm being hard-wired: the account already holds a feed row, the table
// would say INCREMENTAL, and the caller says this chunk still belongs to the
// first sync (`backfill: true`). The batch rebases — the opening figure moves,
// the displayed balance does not.
//
// The honest caller has no reason to send this shape today (the handler asks
// the table before anything has landed), but the semantics must not depend on
// the caller being the one caller we ship: a stamp is a verdict, not a hint,
// in both directions.
export default {
  invariant: 'B-4',
  title: 'a true stamp rebases an account that already has history',
  design: 'import_bank_transactions_atomic 20260829170000 — the stamp read is unconditional, not "stamp may only say incremental"',
  consequence: 'a stamp honoured in one direction only would silently re-derive the other from the table, which is the per-chunk bug wearing a fix\'s clothes',
  parity: 'match',

  setup: aFeedAccountWithHistory,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'B', amount: '-8.00',
          type: 'expense', date: '2024-05-02', external_transaction_id: 'n-2',
          backfill: true },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    // Setup leaves 100.00/110.00 with one −10.00 row. The rebase moves only
    // the opening figure: 110 − (−8) = 118.
    storedBalances(FED, '100.00/118.00'),
    rowsInAccount(FED, '2'),
    balanceIdentityHolds(FED),
  ],
};
