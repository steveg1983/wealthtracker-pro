import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'the only kind of account match that is a fact rather than a guess',
  design: 'src/utils/ofxAccountIdentifiers.ts:216-235',
  consequence: 'this is what a backfill buys the user, and it is the input that lets an '
    + 'importer say destinationConfirmed without a person picking from a list',
  parity: 'match',

  command: {
    verb: 'plan_account_identifier_match',
    payload: {
      ofx: ofxBank(),
      accounts: [
        account({ id: 'savings', type: 'savings' }),
        account({ id: 'target', sort_code: '12-34-56', account_number: '12345678' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { account_id: 'target' },
  rustOnly: { candidates: 'the TypeScript answers with the account or with null and never says how many fitted; the count is a local addition so that no match and too many matches stay two different situations' },
  rustResult: { candidates: 1 },
};
