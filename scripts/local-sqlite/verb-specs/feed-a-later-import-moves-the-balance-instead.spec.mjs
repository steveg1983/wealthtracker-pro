import {
  USER, FED, aFeedAccountWithHistory, storedBalances, balanceIdentityHolds,
} from './_shared.mjs';

// The other arm, and the control that keeps the first one honest: a spec family
// that only tested the rebase would pass just as happily against a port that
// rebases forever. Once the account holds ONE row with an
// external_transaction_id it is no longer a first import, and new money moves
// `balance` like every other write in the schema.
export default {
  invariant: 'B-4',
  title: 'once an account has feed history, an import moves the balance and leaves the opening figure alone',
  design: 'import_bank_transactions_atomic 20260808100000:707-714 — the ELSE arm, balance = balance + v_sum',
  consequence: 'rebasing forever means every sync silently rewrites the account\'s opening balance and no figure in it ever means anything again',
  parity: 'match',

  setup: aFeedAccountWithHistory,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Shop', amount: '-12.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    storedBalances(FED, '88.00/110.00'),
    balanceIdentityHolds(FED),
  ],
};
