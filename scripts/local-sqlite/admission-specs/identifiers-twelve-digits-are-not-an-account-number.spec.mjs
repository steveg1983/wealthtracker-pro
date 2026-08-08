import { ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A2',
  title: 'twelve digits with no sort code in front could be anything',
  design: 'src/utils/ofxAccountIdentifiers.ts:83-92 — "a guessed 8 digits would be stored as fact"',
  consequence: 'a guessed account number is stored as a fact and then matched against',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank({ account_id: '987654321098' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: null, card_last_four: '1098' },
    backfill: null,
  },
};
