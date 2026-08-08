// BEYOND THE VITEST SUITE, and the clause that makes the split above safe:
// the leading six must BE the sort code already in hand. Without that test,
// any fourteen-digit reference would be chopped at six and the last eight
// stored as an account number.
import { ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A2',
  title: 'the split needs the sort code to be the one in the file, not just six digits',
  design: 'src/utils/ofxAccountIdentifiers.ts:104-110 — accountDigits.startsWith(bankDigits)',
  consequence: 'chopping any long reference at six digits stores eight digits of something '
    + 'else as an account number, as fact',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank({ account_id: '99999987654321' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: null, card_last_four: '4321' },
    backfill: null,
  },
};
