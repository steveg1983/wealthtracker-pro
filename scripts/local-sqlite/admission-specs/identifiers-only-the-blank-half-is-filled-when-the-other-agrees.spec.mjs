import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'the recorded sort code agrees, so only the account number is written',
  design: 'src/utils/ofxAccountIdentifiers.ts:175-186',
  consequence: 'the common case after a partial setup, and the one where a blanket write '
    + 'would look identical while being a rewrite',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank(), account: account({ sort_code: '12-34-56' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: '12345678', card_last_four: '5678' },
    backfill: {
      updates: { sort_code: null, account_number: '12345678' },
      summary: 'account number ending 5678',
    },
  },
};
