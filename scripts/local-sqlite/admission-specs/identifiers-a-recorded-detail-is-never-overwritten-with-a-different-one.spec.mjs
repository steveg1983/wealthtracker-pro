import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'a file that disagrees with the account is not this account file',
  design: 'src/utils/ofxAccountIdentifiers.ts:143-152',
  consequence: 'overwriting a recorded identifier repoints every future import at whichever '
    + 'account the wrong file belonged to',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: {
      ofx: ofxBank(),
      account: account({ sort_code: '99-99-99', account_number: '11112222' }),
    },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: '12345678', card_last_four: '5678' },
    backfill: null,
  },
};
