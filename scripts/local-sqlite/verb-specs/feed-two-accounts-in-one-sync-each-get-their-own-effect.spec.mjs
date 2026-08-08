import {
  USER, FED, EVERYDAY, aFeedCreatedAccount,
  storedBalances, balanceIdentityHolds, accountsAudited, auditTrail,
} from './_shared.mjs';

// A sync carries every account on a connection, so one call routinely moves two
// or three balances. Each gets its own backfill decision, its own sum and its own
// audit row.
//
// The ORDER is asserted too, and it is not cosmetic: the cloud walks its
// accumulator with jsonb_each_text, which visits keys in jsonb's own order —
// length, then bytes — and every key is a 36-character uuid, so that is ascending
// byte order. MEASURED (probe-ingest4.sh): the audit rows come out in ascending
// account-id order whichever order the rows arrived in. The local port uses a
// BTreeMap for exactly this reason; a HashMap would make the log's order depend
// on a hash seed.
export default {
  invariant: 'B-4',
  title: 'two accounts in one sync each get their own rebase decision, sum and audit row, in account order',
  design: 'import_bank_transactions_atomic 20260808100000:688-720 — the per-account loop over v_sums',
  consequence: 'one sum shared across accounts moves the wrong balances; one audit row for two accounts loses which of them changed',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'A', amount: '-1.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
        { user_id: USER, account_id: EVERYDAY, description: 'B', amount: '-2.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-2' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0 },

  state: [
    // Both accounts are on their first feed import, so both rebase.
    storedBalances(FED, '100.00/101.00'),
    storedBalances(EVERYDAY, '-25.00/2.00'),
    balanceIdentityHolds(FED),
    balanceIdentityHolds(EVERYDAY),
    accountsAudited('0001,00fe'),
    auditTrail('transaction/create,transaction/create,account/update,account/update'),
  ],
};
