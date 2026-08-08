import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I6',
  title: 'the bank\'s own id on both sides is proof, and proof is not a question',
  design: 'src/utils/statementDuplicates.ts:39-48; TS-INVARIANTS §1.2 TS-I6',
  consequence: 'offering a proven duplicate for review invites the user to import it anyway, '
    + 'which is the one case where "import anyway" must not be available',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ amount: '-63.20', description: 'Direct Debit - STREAMCO  00110022330044', fit_id: '2026060401' })],
      held: [held({ id: 'streamco', amount: '-63.20', description: 'Sky', notes: 'FITID: 2026060401' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [{
      incoming_index: 0, fit_id: '2026060401', held_id: 'streamco',
      held_description: 'Sky', held_date: '2027-02-07', held_amount: '-63.20',
      held_cleared: false, basis: 'fitid', day_gap: 0, description_similarity: 0,
    }],
    possible: [],
  },
};
