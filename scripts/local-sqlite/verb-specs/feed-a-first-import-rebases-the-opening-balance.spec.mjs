import {
  USER, FED, aFeedCreatedAccount, storedBalances, balanceIdentityHolds, auditTrail, fedRow,
} from './_shared.mjs';

// B-4, the whole of it. On an account's FIRST feed import the history it brings
// is already embodied in the snapshot balance the bank reported, so adding it to
// `balance` would count it twice. The function moves `initial_balance` by the
// same amount instead — a rebase, not an override — and the ledger identity
// survives it untouched.
//
// The account here is seeded exactly as api/banking/sync-accounts.ts:255-273
// seeds one: balance = bank_balance = initial_balance = the snapshot, and no
// history. See TS-F7 in the verb's module documentation for what that
// precondition costs; this spec asserts the arithmetic, which is right.
export default {
  invariant: 'B-4',
  title: 'the first feed import moves the opening balance, not the balance',
  design: 'import_bank_transactions_atomic 20260808100000:700-706 — IF (v_backfills->>v_acct_key)::boolean THEN initial_balance = COALESCE(initial_balance,0) - v_sum',
  consequence: 'adding a backfill to `balance` counts 90 days of history twice, and the account is permanently out by its own past',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Shop', amount: '-12.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1',
          external_provider: 'truelayer' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    storedBalances(FED, '100.00/112.00'),
    balanceIdentityHolds(FED),
    fedRow('n-1', '- | confirmed=yes | cleared=no'),
    auditTrail('transaction/create,account/update'),
  ],
};
