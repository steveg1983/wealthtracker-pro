import {
  USER, FED, aFeedCreatedAccount, aPayeeHistory, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// The handler writes 'Bank transaction' when a provider sends no description at
// all. Every such row across every merchant carries that same string, so if it
// participated in payee memory it would become one enormous payee and whatever
// category happened to dominate it would be stamped on every description-less
// row the feed ever produced.
//
// The fixture gives that description a strong history — three rows, two of them
// Groceries — so the guard has something to refuse rather than nothing to find.
export default {
  invariant: 'I-6',
  title: 'the description-less fallback never participates in payee memory',
  design: 'import_bank_transactions_atomic 20260808100000:631-632 — upper(btrim(...)) <> \'BANK TRANSACTION\'',
  consequence: 'matching on it fuses unrelated merchants into one mega-payee and stamps its winner onto every row a provider failed to describe',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, aPayeeHistory('Bank transaction')),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Bank transaction', amount: '-9.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    fedRow('n-1', '- | confirmed=yes | cleared=no'),
    balanceIdentityHolds(FED),
  ],
};
