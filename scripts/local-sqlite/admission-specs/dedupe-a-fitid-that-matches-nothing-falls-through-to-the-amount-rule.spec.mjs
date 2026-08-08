// BEYOND THE VITEST SUITE. A file row carrying an id the register has never
// seen is the ORDINARY case — the register only ever holds a FITID for rows
// this same importer wrote — so it must not be treated as "already handled by
// the proof tier" and skipped.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I6',
  title: 'an unmatched FITID is not a decision, and the row still reaches the evidence tier',
  design: 'src/utils/statementDuplicates.ts:275-279 — only rows the FIRST pass MATCHED are '
    + 'excluded from the second',
  consequence: 'skipping every row that carries an id would switch deduplication off for '
    + 'exactly the files that carry ids, which is every OFX statement',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ amount: '-20.00', description: 'Cash', fit_id: 'never-seen' })],
      held: [held({ id: 'plain', amount: '-20.00', description: 'Cash' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    certain: [],
    possible: [{
      incoming_index: 0, fit_id: 'never-seen', held_id: 'plain',
      held_description: 'Cash', held_date: '2027-02-07', held_amount: '-20.00',
      held_cleared: false, basis: 'amount-and-date', day_gap: 0, description_similarity: 1,
    }],
  },
};
