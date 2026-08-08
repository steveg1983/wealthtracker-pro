import { ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A2',
  title: 'fourteen digits beginning with the sort code already in hand',
  design: 'src/utils/ofxAccountIdentifiers.ts:83-115',
  consequence: 'some banks put both numbers in one tag; without this the account number is '
    + 'unrecognisable and the backfill never happens',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank({ account_id: '12345687654321' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: '87654321', card_last_four: '4321' },
    backfill: null,
  },
};
