import { USER, NEW_ACCOUNT, accountsOwned } from './_shared.mjs';

// The absence DESIGN §6.5 names, reached from the outside: a caller that tries
// to state a balance is told so before a file is opened.
export default {
  invariant: 'B-2',
  title: 'a create that states a balance is refused, because there is no such argument',
  design: 'DESIGN.md §6.5 "Note what is absent: set_account_balance. Deliberately. B-2"; serde’s deny_unknown_fields refuses the key and names the ones that were expected',
  consequence: 'a balance nothing justifies is the drift R-2 exists to report. The cloud accepts one on a create and stores it beside a different initial_balance, which breaks B-1 from the account’s first instant',
  parity: 'divergent',
  reason: 'the cloud’s writer reads the keys it knows out of an object and ignores the rest — a jsonb payload is not a schema — so an extra key changes nothing there and is refused here. What the ORACLE cannot show is the harm: the writer does have a `balance` column and fills it from `account.balance || 0`, and a caller that states two different figures leaves the cloud with a balance no transaction accounts for. That case is a SEAM-level difference and is declared where the seam can see it, in contract.ts’s ACCOUNT_BALANCE_AT_BIRTH',

  command: {
    verb: 'create_account',
    payload: {
      id: NEW_ACCOUNT,
      user_id: USER,
      name: 'Rainy day',
      initial_balance: '200.00',
      balance: '250.50',
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'unknown_field' },
    postgres: { outcome: 'ok' },
  },

  state: [accountsOwned({ sqlite: '2', postgres: '3' })],
};
