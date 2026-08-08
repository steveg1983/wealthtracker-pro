// Two £20 cash withdrawals on one day is a real thing.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'the register holds one, the file carries two, exactly one is flagged',
  design: 'src/utils/statementDuplicates.ts:55-61 — strictly 1:1 and greedy',
  consequence: 'flagging both loses real spending: the count of flagged rows can never exceed '
    + 'the count of held rows that could account for them',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [
        incoming({ amount: '-20.00', description: 'CASH ATM HIGH ST', fit_id: 'fit-1' }),
        incoming({ amount: '-20.00', description: 'CASH ATM HIGH ST', fit_id: 'fit-2' }),
      ],
      held: [held({ id: 'withdrawal', amount: '-20.00', description: 'Cash' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [],
    possible: [{
      incoming_index: 0, fit_id: 'fit-1', held_id: 'withdrawal',
      held_description: 'Cash', held_date: '2027-02-07', held_amount: '-20.00',
      held_cleared: false, basis: 'amount-and-date', day_gap: 0,
      description_similarity: 0.3333333333333333,
    }],
  },
};
