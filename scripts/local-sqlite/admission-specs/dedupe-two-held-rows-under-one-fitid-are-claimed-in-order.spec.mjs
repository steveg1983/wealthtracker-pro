// BEYOND THE VITEST SUITE. A FITID is the bank's id and ought to be unique, but
// the register's copy of it lives in free-text notes and nothing enforces that.
// Two file rows naming the same id must claim the two held rows one apiece —
// the 1:1 rule is not weaker on the proof tier than on the evidence tier.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I6',
  title: 'a repeated FITID pairs off rather than claiming the same row twice',
  design: 'src/utils/statementDuplicates.ts:256-261 — the first UNCLAIMED candidate',
  consequence: 'two file rows both matched to one held row would suppress a payment the '
    + 'register never had',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [
        incoming({ amount: '-20.00', description: 'Cash', fit_id: 'shared' }),
        incoming({ amount: '-20.00', description: 'Cash', fit_id: 'shared' }),
      ],
      held: [
        held({ id: 'first', amount: '-20.00', description: 'Cash', notes: 'FITID: shared' }),
        held({ id: 'second', amount: '-20.00', description: 'Cash', notes: 'FITID: shared' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [
      {
        incoming_index: 0, fit_id: 'shared', held_id: 'first',
        held_description: 'Cash', held_date: '2027-02-07', held_amount: '-20.00',
        held_cleared: false, basis: 'fitid', day_gap: 0, description_similarity: 1,
      },
      {
        incoming_index: 1, fit_id: 'shared', held_id: 'second',
        held_description: 'Cash', held_date: '2027-02-07', held_amount: '-20.00',
        held_cleared: false, basis: 'fitid', day_gap: 0, description_similarity: 1,
      },
    ],
    possible: [],
  },
};
