import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'three eligible held rows, and the most plausible pairing is the one offered',
  design: 'src/utils/statementDuplicates.ts:292-298 — nearest date, then description',
  consequence: 'offering the wrong one of three equal rows for review is how a person '
    + 'confirms a suppression that hides the payment they were looking for',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ date: '2027-02-07', amount: '-50.00', description: 'CARD PAYMENT TO WAITROSE', fit_id: 'fit-1' })],
      held: [
        held({ id: 'far', date: '2027-02-09', amount: '-50.00', description: 'Waitrose' }),
        held({ id: 'near-wrong-words', date: '2027-02-08', amount: '-50.00', description: 'Petrol' }),
        held({ id: 'near-right-words', date: '2027-02-08', amount: '-50.00', description: 'Waitrose' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [],
    possible: [{
      incoming_index: 0, fit_id: 'fit-1', held_id: 'near-right-words',
      held_description: 'Waitrose', held_date: '2027-02-08', held_amount: '-50.00',
      held_cleared: false, basis: 'amount-and-date', day_gap: 1,
      description_similarity: 0.3333333333333333,
    }],
  },
};
