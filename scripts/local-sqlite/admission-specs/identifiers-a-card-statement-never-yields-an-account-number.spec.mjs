import { ofxCard } from './_shared.mjs';

export default {
  invariant: 'TS-A2',
  title: 'a card number is not an account number, and its first eight digits are not either',
  design: 'src/utils/ofxAccountIdentifiers.ts:100-112',
  consequence: 'a full PAN trimmed to eight digits stores the wrong half of a card number in '
    + 'a field the app treats as a bank account number',
  parity: 'match',

  command: { verb: 'plan_account_identifiers', payload: { ofx: ofxCard() } },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: null, account_number: null, card_last_four: '9012' },
    backfill: null,
  },
};
