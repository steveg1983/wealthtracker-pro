import {
  USER, FED, GROCERIES, aFeedCreatedAccount, aPayeeHistory, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// The provenance table's first two rows, in one call so the difference is
// visible rather than asserted twice. Same payee, same account, same direction:
// the only difference is which of them STATED a category.
//
// Note the order matters and is part of what is being tested — the stated row
// lands first and immediately becomes part of the payee history the second row
// is judged against, which is what makes the second row's guess reach the same
// category by a different route and carry a different flag.
export default {
  invariant: 'D-7',
  title: 'a category payee memory guessed is a suggestion; the same category stated by the row is not',
  design: 'import_bank_transactions_atomic 20260808100000:624-643 — v_category_confirmed starts true and only a successful guess sets it false',
  consequence: 'a guess that looks identical to a choice means the register cannot say which rows have been checked, which is the defect the whole column was added for',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, aPayeeHistory('NEW PAYEE')),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'NEW PAYEE', amount: '-1.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'stated',
          category: GROCERIES },
        { user_id: USER, account_id: FED, description: 'NEW PAYEE', amount: '-2.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'guessed' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0 },

  state: [
    fedRow('stated', 'Groceries | confirmed=yes | cleared=no'),
    fedRow('guessed', 'Groceries | confirmed=no | cleared=no'),
    balanceIdentityHolds(FED),
  ],
};
