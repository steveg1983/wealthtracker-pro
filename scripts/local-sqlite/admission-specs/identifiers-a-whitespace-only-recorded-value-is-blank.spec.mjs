import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'three spaces in the sort code column is an empty field, not a contradiction',
  design: 'src/utils/ofxAccountIdentifiers.ts:68',
  consequence: 'treating whitespace as a recorded value would refuse the backfill forever on '
    + 'any account whose field was cleared by typing over it',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank(), account: account({ sort_code: '   ' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    backfill: {
      updates: { sort_code: '12-34-56', account_number: '12345678' },
      summary: 'sort code 12-34-56 and account number ending 5678',
    },
  },
};
