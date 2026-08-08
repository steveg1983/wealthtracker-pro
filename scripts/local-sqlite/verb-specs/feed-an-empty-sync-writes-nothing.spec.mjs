import {
  USER, FED, aFeedCreatedAccount, storedBalances, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// A provider with nothing new to report is the commonest sync there is, and it
// must be free: no balance movement, no audit row, no `updated_at` bump on
// anything. The per-account loop never runs because no account accumulated a
// row.
export default {
  invariant: 'B-2',
  title: 'a sync with no rows in it touches nothing at all',
  design: 'import_bank_transactions_atomic 20260808100000:689-691 — the balance loop is over v_sums, which is empty',
  consequence: 'a routine empty poll that bumped updated_at or wrote an audit row would fill the log with events that did not happen',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: { verb: 'import_bank_transactions', payload: { user_id: USER, rows: [] } },

  expect: { outcome: 'ok' },
  result: { inserted: 0, skipped: 0 },

  state: [
    rowsInAccount(FED, '0'),
    storedBalances(FED, '100.00/100.00'),
    balanceIdentityHolds(FED),
    auditTrail('NONE'),
  ],
};
