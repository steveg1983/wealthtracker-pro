import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A2',
  title: 'an IBAN fragment with no sort code states nothing this rule can store',
  design: 'src/utils/ofxAccountIdentifiers.ts:83-115',
  consequence: 'anything that cannot be recognised for certain is left alone, which is the '
    + 'whole third rule',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank({ account_id: 'GB29NWBK', bank_id: null }), account: account() },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: null, account_number: null, card_last_four: null },
    backfill: null,
  },
};
