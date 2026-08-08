import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'an account with nothing recorded gets both details, and is told so in words',
  design: 'src/utils/ofxAccountIdentifiers.ts:124-189',
  consequence: 'this is what a backfill buys: the next file finds the account by FACT instead '
    + 'of falling through to name-and-type guesswork',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank(), account: account() },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: '12345678', card_last_four: '5678' },
    backfill: {
      updates: { sort_code: '12-34-56', account_number: '12345678' },
      // Never the full number. A message is one more place it would end up.
      summary: 'sort code 12-34-56 and account number ending 5678',
    },
  },
};
