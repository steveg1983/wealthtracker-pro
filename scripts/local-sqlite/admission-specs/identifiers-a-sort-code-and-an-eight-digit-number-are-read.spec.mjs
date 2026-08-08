import { ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A2',
  title: 'the ordinary bank statement, read into the shapes an account stores',
  design: 'src/utils/ofxAccountIdentifiers.ts:83-115; TS-INVARIANTS §1.3',
  consequence: 'these are the identifiers a later import matches an account by, so a wrong one '
    + 'sends the next file to the wrong account with confidence',
  parity: 'match',

  command: { verb: 'plan_account_identifiers', payload: { ofx: ofxBank() } },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: '12345678', card_last_four: '5678' },
    backfill: null,
  },
};
