import {
  USER, FED, aFeedCreatedAccount, balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// TS-I9's first row, and 20260807180000's whole argument: "The bank having
// PROCESSED a payment is not the same as the user having CHECKED it against
// their statement — and only the second is what is_cleared means in this app."
//
// The value is a LITERAL false in the insert, not a passthrough, so there is no
// payload that can make a feed row arrive reconciled. That is why this spec
// sends nothing about it: the absence of the key is the point.
export default {
  invariant: 'A-3',
  title: 'a feed row arrives unreconciled, because the user reconciles and the feed does not',
  design: 'import_bank_transactions_atomic 20260808100000:662 — "false,  -- is_cleared: the user reconciles, the feed does not"',
  consequence: 'pre-cleared rows leave the reconciliation screen with nothing to do, which is why nobody noticed it was doing nothing — and a payment the bank has not sent yet is never caught',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Shop', amount: '-9.00',
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
