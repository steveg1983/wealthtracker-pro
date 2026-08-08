import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'the account number agrees and the sort code does not, so it is not this account',
  design: 'src/utils/ofxAccountIdentifiers.ts:208-213',
  consequence: 'matching on half the identifiers puts a statement into an account it does not '
    + 'belong to, with every row in it',
  parity: 'match',

  command: {
    verb: 'plan_account_identifier_match',
    payload: {
      ofx: ofxBank(),
      accounts: [account({ id: 'target', sort_code: '99-99-99', account_number: '12345678' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { account_id: null },
  rustOnly: { candidates: 'the TypeScript answers with the account or with null and never says how many fitted; the count is a local addition so that no match and too many matches stay two different situations' },
  rustResult: { candidates: 0 },
};
