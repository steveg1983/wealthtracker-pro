import {
  USER, NEW_ACCOUNT,
  accountText, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// The other half of the same rule, and the reason the cloud refuses to guess an
// account's type before applying it.
export default {
  invariant: 'TS-A1',
  title: 'a savings account keeps its whole account number, because it is not a card',
  design: 'accountNumberForStorage(value, isCard=false) trims and stores; only "credit" is a card (accountNumberInput.ts:46)',
  consequence: 'truncating here would destroy a real 8-digit bank number, which is what makes OFX statement matching stop finding its own account',
  parity: 'match',

  command: {
    verb: 'create_account',
    payload: {
      id: NEW_ACCOUNT,
      user_id: USER,
      name: 'Rainy day',
      type: 'savings',
      account_number: '12345678',
      sort_code: '00-00-00',
    },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { account_number: '12345678', sort_code: '00-00-00' },

  state: [
    accountText(NEW_ACCOUNT, 'account_number', '12345678'),
    accountText(NEW_ACCOUNT, 'sort_code', '00-00-00'),
    balanceIdentityHolds(NEW_ACCOUNT),
  ],
};
