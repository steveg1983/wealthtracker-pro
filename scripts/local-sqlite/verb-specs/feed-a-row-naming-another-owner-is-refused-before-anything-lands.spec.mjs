import {
  USER, STRANGER, FED, aFeedCreatedAccount, secondUser, setups,
  storedBalances, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// The one check this function makes per row, before that row does anything at
// all. `p_user_id` is what every row is WRITTEN as, so a row claiming a
// different owner is a request whose intent cannot be carried out — and the
// refusal takes the whole batch, including the perfectly good row ahead of it.
//
// That is the right outcome: a sync whose rows disagree about who they belong to
// is not a sync with one bad row in it, it is a caller that has lost track of
// whose data it is holding.
export default {
  invariant: 'R-12',
  title: 'a row claiming a different owner loses the whole sync, including the good row before it',
  design: 'import_bank_transactions_atomic 20260808100000:584-586 — IF (r->>\'user_id\')::uuid IS DISTINCT FROM p_user_id THEN RAISE … 28000',
  consequence: 'without it every row is silently rewritten as p_user_id\'s, so a mixed batch quietly moves one login\'s transactions into another\'s account',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, secondUser),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Good', amount: '-1.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
        { user_id: STRANGER, account_id: FED, description: 'Theirs', amount: '-2.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-2' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'row user_id does not match p_user_id' },

  state: [
    rowsInAccount(FED, '0'),
    storedBalances(FED, '100.00/100.00'),
    balanceIdentityHolds(FED),
    auditTrail('NONE'),
  ],
};
