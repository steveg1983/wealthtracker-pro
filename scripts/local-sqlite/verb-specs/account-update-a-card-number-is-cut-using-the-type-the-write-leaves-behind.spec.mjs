import {
  USER, EVERYDAY,
  accountText, nowhereInTheAccounts, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// The half of accountNumberUpdateForStorage that a create never has to decide:
// which type the rule applies to, when the payload is changing the type in the
// same breath.
export default {
  invariant: 'TS-A1',
  title: 'switching an account to Credit Card and setting its number in one save is a card write',
  design: 'accountNumberUpdateForStorage (accountNumberInput.ts:137-148) — "what decides the rule is the type the row will HAVE once this write lands"',
  consequence: 'reading the STORED type here would apply the bank rule to a number that is about to be a card number, and store all sixteen digits',
  parity: 'match',

  command: {
    verb: 'update_account',
    payload: {
      id: EVERYDAY,
      user_id: USER,
      patch: { type: 'credit', account_number: '1111222233334444' },
    },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { type: 'credit', account_number: '4444' },

  state: [
    accountText(EVERYDAY, 'account_number', '4444'),
    nowhereInTheAccounts('1111222233334444', '0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
