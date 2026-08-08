// BEYOND THE VITEST SUITE, and the reason `readFitId` is anchored: a bank's
// FITIDs are sequential, so if `FITID: 123` answered a query for `1234` every
// transaction in a range would match its neighbours.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I6',
  title: 'FITID 1234 does not answer to 123, and a mid-line mention is not a FITID at all',
  design: 'src/utils/statementDuplicates.ts:127-140 — anchored to a line start and terminated '
    + 'by end-of-line',
  consequence: 'an unanchored read pairs neighbouring transactions from the same day, which is '
    + 'the shape a bank\'s sequential ids come in',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [
        incoming({ amount: '-1.00', description: 'a', fit_id: '123' }),
        incoming({ amount: '-2.00', description: 'b', fit_id: '7' }),
      ],
      held: [
        held({ id: 'longer', amount: '-1.00', description: 'a', notes: 'FITID: 1234' }),
        held({ id: 'mid-line', amount: '-2.00', description: 'b', notes: 'paid the FITID: 7 invoice' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    // Neither is proof — and both still pair on amount and date, which is the
    // right outcome: they ARE the same rows, they are just not PROVEN to be.
    certain: [],
    possible: [
      {
        incoming_index: 0, fit_id: '123', held_id: 'longer',
        held_description: 'a', held_date: '2027-02-07', held_amount: '-1.00',
        held_cleared: false, basis: 'amount-and-date', day_gap: 0, description_similarity: 0,
      },
      {
        incoming_index: 1, fit_id: '7', held_id: 'mid-line',
        held_description: 'b', held_date: '2027-02-07', held_amount: '-2.00',
        held_cleared: false, basis: 'amount-and-date', day_gap: 0, description_similarity: 0,
      },
    ],
  },
};
