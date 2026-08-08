import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'ambiguity is reported as no match, because choosing is not this rule to make',
  design: 'src/utils/ofxAccountIdentifiers.ts:216-235 — matches.length === 1',
  consequence: 'two accounts with the same identifiers is a data problem; picking one of them '
    + 'silently files a whole statement against a coin toss',
  parity: 'match',

  command: {
    verb: 'plan_account_identifier_match',
    payload: {
      ofx: ofxBank(),
      accounts: [
        account({ id: 'a', account_number: '12345678' }),
        account({ id: 'b', account_number: '12345678' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { account_id: null },
  rustOnly: { candidates: 'the TypeScript answers with the account or with null and never says how many fitted; the count is a local addition so that no match and too many matches stay two different situations' },
  // The count is where the port says more than its oracle: null here means
  // TWO, and null in the sibling spec means none. Same answer, opposite fix.
  rustResult: { candidates: 2 },
};
