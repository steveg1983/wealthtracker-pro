import {
  USER, FED, aFeedCreatedAccount, aPayeeHistory, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// I-6, and the change 20260722140000 was written to make: "file one Amazon order
// as Household : Repairs and every subsequent Amazon import inherits Repairs,
// however many dozens of Consumables rows preceded it".
//
// The fixture is that shape exactly — two Groceries rows and ONE later Fuel row.
// Most-recent picks Fuel. Most-common picks Groceries, and does so even though
// the Fuel row is the freshest thing in the account.
export default {
  invariant: 'I-6',
  title: 'payee memory files a new row under the habit, not under the last thing that happened',
  design: 'payee_memory_category 20260722140000:41 — ORDER BY COUNT(*) DESC first, MAX(date) DESC only as a tie-break',
  consequence: 'most-recent lets one mis-filed row redirect every future import of that payee, and nobody notices until a month of statements is filed wrongly',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, aPayeeHistory()),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'BIG SHOP', amount: '-9.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    fedRow('n-1', 'Groceries | confirmed=no | cleared=no'),
    balanceIdentityHolds(FED),
  ],
};
