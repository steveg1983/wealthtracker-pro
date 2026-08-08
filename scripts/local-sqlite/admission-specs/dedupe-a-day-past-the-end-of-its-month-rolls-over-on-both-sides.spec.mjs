// BEYOND THE VITEST SUITE, and the reason `admission::day` is not
// `wire::is_calendar_date`. `Date.parse` is not a validator: the ECMAScript
// date-only syntax bounds the day at 31 and MakeDay carries the excess into the
// next month. 30 February 2027 IS a date to this rule, and it is 2 March.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: '30 February is 2 March on both sides, including in what the review list shows',
  design: 'crates/wealth-core/src/admission/day.rs — measured against node 22.17.0',
  consequence: 'a port that refused the impossible day would drop the row out of matching '
    + 'altogether and re-import it, while a port that rolled it over differently would pair '
    + 'it with the wrong week',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ date: '2027-03-02', amount: '-20.00', description: 'Cash', fit_id: 'fit-1' })],
      held: [held({ id: 'rolled', date: '2027-02-30', amount: '-20.00', description: 'Cash' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [],
    possible: [{
      incoming_index: 0, fit_id: 'fit-1', held_id: 'rolled',
      held_description: 'Cash',
      // Not the text that was stored — the day it means.
      held_date: '2027-03-02',
      held_amount: '-20.00', held_cleared: false, basis: 'amount-and-date',
      day_gap: 0, description_similarity: 1,
    }],
  },
};
