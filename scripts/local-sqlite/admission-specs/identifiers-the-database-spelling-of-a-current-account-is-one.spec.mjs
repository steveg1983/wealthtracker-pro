import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'checking is what the database calls a current account, and it has bank details',
  design: 'src/utils/ofxAccountIdentifiers.ts:74-81',
  consequence: 'a row that reaches this rule untranslated would silently record nothing, and '
    + 'nothing is exactly what a missing type looks like',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank(), account: account({ type: 'checking' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    backfill: {
      updates: { sort_code: '12-34-56', account_number: '12345678' },
      summary: 'sort code 12-34-56 and account number ending 5678',
    },
  },
};
