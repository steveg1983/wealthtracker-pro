import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'a settlement-date gap of three days still pairs',
  design: 'src/utils/statementDuplicates.ts:66-71 — feeds post on the settlement date',
  consequence: 'a window too narrow re-imports every row the bank posted a day late',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ date: '2027-02-07', amount: '-63.20', description: 'Direct Debit - STREAMCO  00110022330044', fit_id: 'fit-1' })],
      held: [held({ id: 'streamco', date: '2027-02-10', amount: '-63.20', description: 'Direct Debit - STREAMCO' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [],
    possible: [{
      incoming_index: 0, fit_id: 'fit-1', held_id: 'streamco',
      held_description: 'Direct Debit - STREAMCO', held_date: '2027-02-10',
      held_amount: '-63.20', held_cleared: false, basis: 'amount-and-date',
      day_gap: 3, description_similarity: 0.75,
    }],
  },
};
