import {
  USER, FED, aFeedCreatedAccount, storedBalances, balanceIdentityHolds, rowsInAccount,
} from './_shared.mjs';

// The gap in both dedupe mechanisms, measured and reproduced. `t.external_
// transaction_id = r->>'external_transaction_id'` is NULL — never true — when
// the row states none, and the partial unique index does not cover such rows at
// all. So two identical description/amount/date rows with no provider id are two
// rows, on both engines.
//
// Which is correct: a statement may legally contain two identical payments, and
// the same argument 20260808140000:66-71 makes about content hashes applies
// here. Recorded because "the feed dedupes" is exactly the sort of half-true
// summary a port inherits without checking.
export default {
  invariant: 'I-1',
  title: 'a feed row with no provider id is deduped by nothing, and two of them are two rows',
  design: 'import_bank_transactions_atomic 20260808100000:604-611 and :666-668 — the EXISTS compares to NULL, and the arbiter index is partial on external_transaction_id IS NOT NULL',
  consequence: 'the opposite would be worse: two £4.25 coffees on one Tuesday are two payments, and a dedupe that collapsed them would delete money',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01' },
        { user_id: USER, account_id: FED, description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0 },

  state: [
    rowsInAccount(FED, '2'),
    storedBalances(FED, '100.00/108.50'),
    balanceIdentityHolds(FED),
  ],
};
