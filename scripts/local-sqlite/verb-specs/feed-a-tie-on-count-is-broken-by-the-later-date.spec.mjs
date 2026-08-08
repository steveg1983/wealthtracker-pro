import {
  USER, FED, aFeedCreatedAccount, aPayeeTiedOnCount, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// Tie-break 1 of 2, and the reason the habit rule does not simply freeze: with
// one row each, the LATER filing wins, so a genuine change of meaning still
// takes over once it becomes the habit.
export default {
  invariant: 'I-6',
  title: 'when a payee is filed equally often under two categories, the later one wins',
  design: 'payee_memory_category 20260722140000:41 — MAX(t.date) DESC, the second ordering key',
  consequence: 'without it the answer is whatever the planner happens to return, so the same file imports differently on two machines',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, aPayeeTiedOnCount),
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
    fedRow('n-1', 'Fuel | confirmed=no | cleared=no'),
    balanceIdentityHolds(FED),
  ],
};
