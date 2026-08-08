import {
  USER, FED, aFeedCreatedAccount, aPayeeHistory, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// Payee memory is per payee AND per direction. The same name can be both — a
// shop you buy from and get refunds from — and filing a refund under a spending
// category puts money on the wrong side of every report that reads it.
//
// The fixture's history is entirely expenses, so an incoming INCOME row finds
// nothing and arrives blank rather than borrowing Groceries.
export default {
  invariant: 'I-6',
  title: 'a payee\'s expense history says nothing about its income rows',
  design: 'payee_memory_category 20260722140000:36 — AND t.type = p_type',
  consequence: 'a refund filed under a spending category is a negative expense in every report, and the category total is wrong by twice the refund',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, aPayeeHistory()),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'BIG SHOP', amount: '9.00',
          type: 'income', date: '2024-05-01', external_transaction_id: 'n-1' },
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
