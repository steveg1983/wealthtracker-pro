import {
  USER, FED, aFeedCreatedAccount, aPayeeHistory, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// `t.type = p_type AND t.type <> 'transfer'` is not redundant: together the two
// clauses mean a transfer can neither be taught nor teach. The migration's own
// reason is the one that bites in a real account — "a reclassified standing
// order must not stamp 'transfer-out' onto next month's plain import".
//
// The incoming row here is a transfer with a rich expense history behind its
// payee, so a port that dropped the second clause would file it under Groceries.
export default {
  invariant: 'I-6',
  title: 'a transfer row inherits nothing, however well known its payee is',
  design: 'payee_memory_category 20260722140000:36-37 — t.type = p_type AND t.type <> \'transfer\', which together exclude transfers in both directions',
  consequence: 'a standing order that was once reclassified would stamp a transfer category onto next month\'s ordinary import, and the transfer report would count money that never moved between accounts',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, aPayeeHistory()),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'BIG SHOP', amount: '-9.00',
          type: 'transfer', date: '2024-05-01', external_transaction_id: 'n-1' },
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
