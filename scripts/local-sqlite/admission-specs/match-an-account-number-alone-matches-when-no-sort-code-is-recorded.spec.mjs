import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'a sort code that was never recorded is missing information, not a contradiction',
  design: 'src/utils/ofxAccountIdentifiers.ts:208-213',
  consequence: 'refusing here would mean an account can never be matched until somebody types '
    + 'in a detail the file was going to fill in for them',
  parity: 'match',

  command: {
    verb: 'plan_account_identifier_match',
    payload: {
      ofx: ofxBank(),
      accounts: [account({ id: 'target', account_number: '12345678' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { account_id: 'target' },
  rustOnly: { candidates: 'the TypeScript answers with the account or with null and never says how many fitted; the count is a local addition so that no match and too many matches stay two different situations' },
  rustResult: { candidates: 1 },
};
