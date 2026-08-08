import {
  USER, FED, aFeedCreatedAccount, balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// The provenance table's THIRD row, and the one that looks wrong. A row payee
// memory could not file arrives with no category and `category_confirmed = true`
// — because "a blank has nothing to vouch for, and marking blanks unconfirmed
// would put rows with no category into the 'check these suggestions' list, where
// there is nothing to look at".
//
// Uncategorised rows are a different chore with their own screen. Verification 3
// of 20260808100000 asserts the same thing globally: no row is ever an
// unconfirmed blank.
export default {
  invariant: 'D-7',
  title: 'a row payee memory could not file is uncategorised, not an unconfirmed suggestion',
  design: 'import_bank_transactions_atomic 20260808100000:626-642 — "Only if the guess actually produced something"',
  consequence: 'an unconfirmed blank appears in the confirm-or-edit list with nothing in it to confirm, and the list stops being a list of decisions',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'UNKNOWN PAYEE', amount: '-9.00',
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
