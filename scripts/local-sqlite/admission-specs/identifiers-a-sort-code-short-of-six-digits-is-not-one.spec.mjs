import { ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A2',
  title: 'four digits are not a sort code, and half of one is worse than none',
  design: 'src/utils/ofxAccountIdentifiers.ts:97',
  consequence: 'storing a wrong sort code is worse than storing none, because the NEXT import '
    + 'would then match confidently to the wrong account',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank({ bank_id: '1234' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: null, account_number: '12345678', card_last_four: '5678' },
    backfill: null,
  },
};
