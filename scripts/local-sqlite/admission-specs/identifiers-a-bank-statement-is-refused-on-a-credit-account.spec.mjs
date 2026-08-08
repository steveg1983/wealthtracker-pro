import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'a file quoting a sort code is not a card statement at all',
  design: 'src/utils/ofxAccountIdentifiers.ts:117-122, :154-164',
  consequence: 'storing a bank account number in a card account number field breaks the mask '
    + 'match a bank feed uses to link the card',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank(), account: account({ type: 'credit' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: '12345678', card_last_four: '5678' },
    backfill: null,
  },
};
