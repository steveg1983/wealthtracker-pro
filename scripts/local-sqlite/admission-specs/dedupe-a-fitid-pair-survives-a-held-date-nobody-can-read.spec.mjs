// BEYOND THE VITEST SUITE. The held row is indexed by FITID whether or not its
// date is readable — only the amount tier requires a position on the calendar —
// so the bank's own identity still holds, and the match reports a day it does
// not have as absent rather than inventing one.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I6',
  title: 'proof does not need a date, and the gap it cannot state is 0 rather than a guess',
  design: 'src/utils/statementDuplicates.ts:240-248 vs :262 — the FITID index has no finite '
    + 'check, and the gap falls back to 0 when it cannot be computed',
  consequence: 'refusing the bank\'s own identity because the register\'s date column is '
    + 'unreadable re-imports a row the bank has already named',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ amount: '-63.20', description: 'STREAMCO', fit_id: '2026060401' })],
      held: [held({ id: 'streamco', date: 'nonsense', amount: '-63.20', description: 'Sky', notes: 'FITID: 2026060401' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [{
      incoming_index: 0, fit_id: '2026060401', held_id: 'streamco',
      held_description: 'Sky',
      // An Invalid Date serialises as JSON null, and the port has nothing to
      // report either. The two arrive at the same answer from opposite ends.
      held_date: null,
      held_amount: '-63.20', held_cleared: false, basis: 'fitid',
      day_gap: 0, description_similarity: 0,
    }],
    possible: [],
  },
};
