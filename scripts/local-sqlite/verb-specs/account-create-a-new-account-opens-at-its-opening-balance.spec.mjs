import {
  USER, NEW_ACCOUNT,
  balanceIdentityHolds, transferCategoriesFor, accountsOwned,
} from './_shared.mjs';

// The happy path of the family, and the one that fixes what a create MEANS:
// one figure, and a To/From category minted by the file rather than by the verb.
export default {
  invariant: 'B-1',
  title: 'a create stores one account at its opening balance, and the ledger identity holds',
  design: 'PHASE3-PLAN D-2; the oracle is accountService.createAccount:223-287 (a PostgREST INSERT, no RPC), transcribed in lib/verb-postgres.mjs',
  consequence: 'an account whose stored balance no transaction justifies is an account whose every displayed figure is a fiction — and unlike the cloud, this file has verify_integrity watching',
  parity: 'match',

  command: {
    verb: 'create_account',
    payload: {
      id: NEW_ACCOUNT,
      user_id: USER,
      name: 'Holiday fund',
      type: 'savings',
      // A decimal STRING. Never a JSON number: a JSON number is a double.
      initial_balance: '250.50',
      currency: 'GBP',
      institution: 'Made Up Bank',
      notes: 'Set aside for the boiler',
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    created_at: 'the instant of the write, on two clocks and in two transactions',
    updated_at: 'the same instant, and the same two clocks',
  },

  result: {
    id: NEW_ACCOUNT,
    name: 'Holiday fund',
    type: 'savings',
    currency: 'GBP',
    // The whole of the one-figure rule: the account is born holding exactly
    // what it opened with, because there is nothing else it could be holding.
    balance: '250.50',
    initial_balance: '250.50',
    institution: 'Made Up Bank',
    notes: 'Set aside for the boiler',
    is_active: true,
    account_number: null,
    sort_code: null,
    opening_balance_date: null,
    last_reconciled_balance: null,
  },

  state: [
    balanceIdentityHolds(NEW_ACCOUNT),
    // C-3, on both engines, from the trigger and not from the verb.
    transferCategoriesFor(NEW_ACCOUNT, 'To/From Holiday fund:open'),
    accountsOwned('3'),
  ],
};
