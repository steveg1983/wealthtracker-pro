import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'nothing recorded is ever replaced, even by a file that agrees with it',
  design: 'src/utils/ofxAccountIdentifiers.ts:175-186 — the write is into a BLANK field',
  consequence: 'a backfill that rewrote agreeing values would be a write with no purpose and '
    + 'an audit entry with no cause',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: {
      ofx: ofxBank(),
      account: account({ sort_code: '12-34-56', account_number: '12345678' }),
    },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: '12345678', card_last_four: '5678' },
    backfill: null,
  },
};
