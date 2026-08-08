// Both held rows are -£20 on the day, so the amount rule would happily pair
// either one. The row the bank NAMES must not be stolen from it.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I6',
  title: 'the proof tier runs first, so evidence can never break up a proven pair',
  design: 'src/utils/statementDuplicates.ts:254-255 — "First, so a FITID pair can never be '
    + 'broken up by the weaker rule below"',
  consequence: 'a proven duplicate demoted to "possible" is one a person can wave through',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [
        incoming({ amount: '-20.00', description: 'CASH', fit_id: 'known' }),
        incoming({ amount: '-20.00', description: 'CASH', fit_id: 'unknown' }),
      ],
      held: [
        held({ id: 'plain', amount: '-20.00', description: 'Cash' }),
        held({ id: 'identified', amount: '-20.00', description: 'Cash', notes: 'FITID: known' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [{
      incoming_index: 0, fit_id: 'known', held_id: 'identified',
      held_description: 'Cash', held_date: '2027-02-07', held_amount: '-20.00',
      held_cleared: false, basis: 'fitid', day_gap: 0, description_similarity: 1,
    }],
    possible: [{
      incoming_index: 1, fit_id: 'unknown', held_id: 'plain',
      held_description: 'Cash', held_date: '2027-02-07', held_amount: '-20.00',
      held_cleared: false, basis: 'amount-and-date', day_gap: 0, description_similarity: 1,
    }],
  },
};
