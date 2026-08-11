import {
  USER, EVERYDAY,
  accountText, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// The stored type decides when the payload does not state one — and the account
// is a current account, so eight digits are eight digits.
export default {
  invariant: 'TS-A1',
  title: 'an importer that sends only an account number gets the stored type’s rule',
  design: 'accountNumberUpdateForStorage: `updates.type !== undefined ? isCardAccountType(updates.type) : isCardAccountTypeValue(storedType)`',
  consequence: 'an importer filling in identifiers sends the number and nothing else; guessing "not a card" would be right here and wrong on a credit account, which is why the cloud reads the row back rather than defaulting',
  parity: 'match',

  command: {
    verb: 'update_account',
    payload: { id: EVERYDAY, user_id: USER, patch: { account_number: '12345678' } },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { account_number: '12345678' },

  state: [
    accountText(EVERYDAY, 'account_number', '12345678'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
