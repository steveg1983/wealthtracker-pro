import { account, ofxCard } from './_shared.mjs';

export default {
  invariant: 'TS-A1',
  title: 'XXXXXXXXXXXX3456 is four digits and twelve characters that are not digits',
  design: 'src/utils/accountNumberInput.ts:87-89 — digits only, then the LAST four',
  consequence: 'a masked number read left-to-right stores the mask instead of the digits',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: {
      ofx: ofxCard({ account_id: 'XXXXXXXXXXXX3456' }),
      account: account({ type: 'credit' }),
    },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: null, account_number: null, card_last_four: '3456' },
    backfill: {
      updates: { sort_code: null, account_number: '3456' },
      summary: 'card ending 3456',
    },
  },
};
