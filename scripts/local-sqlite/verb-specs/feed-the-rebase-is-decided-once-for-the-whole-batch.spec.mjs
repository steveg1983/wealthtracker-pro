import {
  USER, FED, aFeedCreatedAccount, storedBalances, balanceIdentityHolds,
} from './_shared.mjs';

// "Backfill detection MUST precede the account's first insert of this call" —
// the comment on 20260808100000:591-592, made executable. Row 1 lands and gives
// the account feed history; if the answer were re-asked for row 2 it would come
// back INCREMENTAL and the batch would be split across both arms, moving half
// the money twice.
//
// The two-row payload is the smallest thing that can tell the two readings apart:
// with one row they agree.
export default {
  invariant: 'B-4',
  title: 'the whole batch takes the answer the account gave before its first row landed',
  design: 'import_bank_transactions_atomic 20260808100000:593-600 — the v_backfills cache, keyed per account',
  consequence: 'a per-row decision splits one import between the two arms: the first row rebases and the rest move the balance, so the account gains money that never existed',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'A', amount: '-12.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
        { user_id: USER, account_id: FED, description: 'B', amount: '-8.00',
          type: 'expense', date: '2024-05-02', external_transaction_id: 'n-2' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0 },

  state: [
    // Both rows rebased: 100 − (−20) = 120. A per-row decision would give
    // 92.00/112.00 instead.
    storedBalances(FED, '100.00/120.00'),
    balanceIdentityHolds(FED),
  ],
};
