import {
  USER, FED, GROCERIES, aFeedCreatedAccount, twoFilingChoices, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// "Rows inserted earlier in this same batch participate, so a categorized payee
// cascades through the whole import" (20260722140000:119-120). The payee here
// has no history at all before the call; the FIRST row states a category and the
// second, identical in every other way, inherits it.
//
// It is the same property the dedupe relies on — the lookup reads the table, and
// the table already holds what this call has written — and it is what makes an
// import of a new merchant self-consistent instead of half-filed.
export default {
  invariant: 'I-6',
  title: 'a categorised row cascades through the rest of the same import',
  design: 'import_bank_transactions_atomic 20260808100000:613-643 — the lookup runs per row, against the table this call is writing into',
  consequence: 'without it the first occurrence of a new merchant is filed and every later one in the same statement is left blank, which is the chore the feature exists to remove',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, twoFilingChoices),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'NEW PAYEE', amount: '-10.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'first',
          category: GROCERIES },
        { user_id: USER, account_id: FED, description: 'NEW PAYEE', amount: '-11.00',
          type: 'expense', date: '2024-05-02', external_transaction_id: 'second' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0 },

  state: [
    fedRow('first', 'Groceries | confirmed=yes | cleared=no'),
    fedRow('second', 'Groceries | confirmed=no | cleared=no'),
    balanceIdentityHolds(FED),
  ],
};
