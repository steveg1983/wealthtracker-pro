import {
  USER, FED, aFeedAccountWithHistory, storedBalances, balanceIdentityHolds,
  rowsInAccount, auditTrail,
} from './_shared.mjs';

// I-1 through the RPC. The unique index only covers (connection_id,
// external_transaction_id), so it says nothing about a row whose connection has
// changed — a reconnect mints a new connection_id and every row would come back
// as new. The EXISTS test is what actually stops that, and it is scoped to the
// ACCOUNT.
export default {
  invariant: 'I-1',
  title: 'a provider id this account already holds is skipped, whatever connection it arrives under',
  design: 'import_bank_transactions_atomic 20260808100000:602-611 — "the handler pre-filters per connection; this also catches re-imports after a reconnect under a new connection_id"',
  consequence: 'a reconnect would re-import the provider\'s whole window and double every transaction in it',
  parity: 'match',

  setup: aFeedAccountWithHistory,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Old feed row', amount: '-10.00',
          type: 'expense', date: '2024-01-01', external_transaction_id: 'old-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 0, skipped: 1 },

  state: [
    rowsInAccount(FED, '1'),
    storedBalances(FED, '100.00/110.00'),
    balanceIdentityHolds(FED),
    // Nothing landed, so no account reached the balance loop and there is no
    // audit row of any kind.
    auditTrail('NONE'),
  ],
};
