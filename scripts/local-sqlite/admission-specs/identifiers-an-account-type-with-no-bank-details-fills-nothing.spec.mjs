import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'a loan has no sort code to record',
  design: 'src/utils/ofxAccountIdentifiers.ts:74-81, :166-170',
  consequence: 'recording bank details against an account type that has none makes the next '
    + 'file match to something that cannot be its source',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank(), account: account({ type: 'loan' }) },
  },

  expect: { outcome: 'ok' },
  result: { backfill: null },
};
