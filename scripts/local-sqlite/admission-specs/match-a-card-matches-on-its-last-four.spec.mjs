import { account, ofxCard } from './_shared.mjs';

export default {
  invariant: 'TS-A1',
  title: 'the four digits a card account stores are the four the file is matched on',
  design: 'src/utils/ofxAccountIdentifiers.ts:191-201 — exactly as the bank feed matches a mask',
  consequence: 'a card can only ever be identified by its last four, because the last four is '
    + 'all this app is allowed to hold',
  parity: 'match',

  command: {
    verb: 'plan_account_identifier_match',
    payload: {
      ofx: ofxCard(),
      accounts: [
        account({ id: 'savings', type: 'savings' }),
        account({ id: 'card', type: 'credit', account_number: '9012' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { account_id: 'card' },
  rustOnly: { candidates: 'the TypeScript answers with the account or with null and never says how many fitted; the count is a local addition so that no match and too many matches stay two different situations' },
  rustResult: { candidates: 1 },
};
