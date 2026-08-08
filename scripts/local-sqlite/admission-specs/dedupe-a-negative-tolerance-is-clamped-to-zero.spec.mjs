// A caller that computes its own window can hand over a negative one. Clamped
// rather than obeyed, so the answer is "same day only" and never "nothing at
// all" — which would silently switch deduplication off.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'a negative window is the same-day window, not the empty one',
  design: 'src/utils/statementDuplicates.ts:235 — Math.max(0, …)',
  consequence: 'an unclamped negative window compares gap > -5 for every candidate and pairs '
    + 'nothing, which looks exactly like a statement with no duplicates in it',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      date_tolerance_days: -5,
      incoming: [incoming({ date: '2027-02-07', amount: '-20.00', description: 'Cash', fit_id: 'fit-1' })],
      held: [
        held({ id: 'next-day', date: '2027-02-08', amount: '-20.00', description: 'Cash' }),
        held({ id: 'same-day', date: '2027-02-07', amount: '-20.00', description: 'Cash' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [],
    possible: [{
      incoming_index: 0, fit_id: 'fit-1', held_id: 'same-day',
      held_description: 'Cash', held_date: '2027-02-07', held_amount: '-20.00',
      held_cleared: false, basis: 'amount-and-date', day_gap: 0, description_similarity: 1,
    }],
  },
};
