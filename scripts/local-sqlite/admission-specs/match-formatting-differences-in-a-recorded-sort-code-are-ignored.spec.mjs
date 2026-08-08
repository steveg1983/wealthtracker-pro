import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: '123456 and 12-34-56 are one sort code',
  design: 'src/utils/ofxAccountIdentifiers.ts:70-72 — compared as digits',
  consequence: 'a formatting mismatch would send the file to the name-and-type guesswork, '
    + 'which is what the recorded details exist to avoid',
  parity: 'match',

  command: {
    verb: 'plan_account_identifier_match',
    payload: {
      ofx: ofxBank(),
      accounts: [account({ id: 'target', sort_code: '123456', account_number: '12345678' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { account_id: 'target' },
  rustOnly: { candidates: 'the TypeScript answers with the account or with null and never says how many fitted; the count is a local addition so that no match and too many matches stay two different situations' },
  rustResult: { candidates: 1 },
};
