import {
  USER, NEW_ACCOUNT,
  accountText, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// `|| null` is falsy-wise, so '' takes the same branch as undefined. Worth its
// own spec because the UPDATE verb makes the opposite decision for the same
// column, and the two helpers really do differ.
export default {
  invariant: 'D-2',
  title: 'a blank field on a create is stored as nothing rather than as an empty string',
  design: 'accountService.createAccount: `account.institution || null`, `account.notes || null`, and accountNumberForStorage’s `stored === \'\' ? undefined`',
  consequence: 'an empty string in a nullable column is a value that reads as present everywhere it is tested for presence — including in the low-balance and OFX-matching code that asks "is there a number here?"',
  parity: 'match',

  command: {
    verb: 'create_account',
    payload: {
      id: NEW_ACCOUNT,
      user_id: USER,
      name: 'Blanks',
      institution: '',
      notes: '',
      sort_code: '',
      account_number: '',
      opening_balance_date: '',
    },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: {
    institution: null,
    notes: null,
    sort_code: null,
    account_number: null,
    opening_balance_date: null,
  },

  state: [
    accountText(NEW_ACCOUNT, 'account_number', 'NULL'),
    accountText(NEW_ACCOUNT, 'opening_balance_date', 'NULL'),
    balanceIdentityHolds(NEW_ACCOUNT),
  ],
};
