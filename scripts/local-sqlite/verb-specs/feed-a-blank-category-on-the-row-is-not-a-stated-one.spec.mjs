import {
  USER, FED, aFeedCreatedAccount, aPayeeHistory, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// `NULLIF(btrim(COALESCE(r->>'category','')),'')`: a row that states whitespace
// has not stated anything, so payee memory still runs and the result is still a
// suggestion. A port that tested `category IS NOT NULL` instead would take the
// blank as a decision, skip the guess, AND mark the empty result confirmed —
// wrong twice from one missing btrim.
export default {
  invariant: 'D-7',
  title: 'a row whose category is blank has not stated one, and payee memory still runs',
  design: 'import_bank_transactions_atomic 20260808100000:624 — NULLIF(btrim(COALESCE(r->>\'category\',\'\')),\'\')',
  consequence: 'treating a blank as a decision skips the guess and marks the empty result vouched-for, so the row is neither categorised nor listed as needing it',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, aPayeeHistory()),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'BIG SHOP', amount: '-9.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1', category: '   ' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    fedRow('n-1', 'Groceries | confirmed=no | cleared=no'),
    balanceIdentityHolds(FED),
  ],
};
