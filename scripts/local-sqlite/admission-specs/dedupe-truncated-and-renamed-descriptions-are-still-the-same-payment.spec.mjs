// THE BUG, in one spec. Every one of these five rows was imported a second time
// because the only test was "does the held row's notes contain this FITID", and
// a row that came from anywhere but this importer carries no FITID at all.
import { ACCOUNT, PAIR_SHAPES, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'five pairs, no shared wording, and every one of them found',
  design: 'src/utils/statementDuplicates.ts:16-53; TS-INVARIANTS §1.2 TS-I7',
  consequence: 'a re-imported statement doubles every payment in the overlap — held descriptions '
    + 'are truncated by whatever wrote them and users rename payees, so a rule that required the '
    + 'two sides to agree would find none of these',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: PAIR_SHAPES.map((pair, index) => incoming({
        amount: pair.amount,
        description: pair.fileDescription,
        fit_id: `fit-${index}`,
      })),
      held: PAIR_SHAPES.map((pair, index) => held({
        id: `held-${index}`,
        amount: pair.amount,
        description: pair.heldDescription,
        cleared: true,
      })),
    },
  },

  expect: { outcome: 'ok' },
  result: {
    // Not one is proof: no held row carries a FITID, which is the whole defect.
    certain: [],
    possible: [
      {
        incoming_index: 0, fit_id: 'fit-0', held_id: 'held-0',
        held_description: 'Sweep Transfer from account 5566', held_date: '2027-02-07',
        held_amount: '9876.54', held_cleared: true, basis: 'amount-and-date',
        day_gap: 0, description_similarity: 0.6666666666666666,
      },
      {
        incoming_index: 1, fit_id: 'fit-1', held_id: 'held-1',
        held_description: 'Direct Debit - STREAMCO', held_date: '2027-02-07',
        held_amount: '-63.20', held_cleared: true, basis: 'amount-and-date',
        day_gap: 0, description_similarity: 0.75,
      },
      {
        incoming_index: 2, fit_id: 'fit-2', held_id: 'held-2',
        held_description: 'SAMPLE PERSON A', held_date: '2027-02-07',
        held_amount: '-2500.00', held_cleared: true, basis: 'amount-and-date',
        day_gap: 0, description_similarity: 0.2,
      },
      {
        incoming_index: 3, fit_id: 'fit-3', held_id: 'held-3',
        held_description: 'Nadia', held_date: '2027-02-07',
        held_amount: '-410.00', held_cleared: true, basis: 'amount-and-date',
        // Nothing in common with the bank's wording. Any rule that required the
        // descriptions to be similar would have missed this and doubled £410.
        day_gap: 0, description_similarity: 0,
      },
      {
        incoming_index: 4, fit_id: 'fit-4', held_id: 'held-4',
        held_description: 'Direct Debit - TELCO LTD  447', held_date: '2027-02-07',
        held_amount: '-77.45', held_cleared: true, basis: 'amount-and-date',
        day_gap: 0, description_similarity: 0.5714285714285714,
      },
    ],
  },
};
