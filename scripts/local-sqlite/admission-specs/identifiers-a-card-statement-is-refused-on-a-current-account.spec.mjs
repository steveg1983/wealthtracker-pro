import { account, ofxCard } from './_shared.mjs';

export default {
  invariant: 'TS-A2',
  title: 'a card file has nothing a current account may store',
  design: 'src/utils/ofxAccountIdentifiers.ts:166-170',
  consequence: 'the first eight digits of a PAN are not an account number, they are the wrong '
    + 'half of a card number',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxCard(), account: account() },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: null, account_number: null, card_last_four: '9012' },
    backfill: null,
  },
};
