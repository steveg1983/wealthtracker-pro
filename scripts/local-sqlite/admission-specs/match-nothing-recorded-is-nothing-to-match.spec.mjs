import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'accounts that record no identifiers cannot be matched by identifier',
  design: 'src/utils/ofxAccountIdentifiers.ts:204-206',
  consequence: 'this is the state every account is in before its first backfill, and it must '
    + 'fall through to the name-and-type guesswork rather than matching everything',
  parity: 'match',

  command: {
    verb: 'plan_account_identifier_match',
    payload: {
      ofx: ofxBank(),
      accounts: [account({ id: 'savings', type: 'savings' }), account({ id: 'blank' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { account_id: null },
  rustOnly: { candidates: 'the TypeScript answers with the account or with null and never says how many fitted; the count is a local addition so that no match and too many matches stay two different situations' },
  rustResult: { candidates: 0 },
};
