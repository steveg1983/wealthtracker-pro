import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'two identical legs and one feed row: one handover, one leg imported',
  design: 'src/services/import/msMoney/feedOverlap.ts:46-52 — "strictly 1:1" holds under handover',
  consequence: 'a feed row that took both legs would delete a real transfer and leave its '
    + 'counterpart pointing at nothing',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [
        moneyLeg({ id: 'mny-txn-a', amount: '-1500.00' }),
        moneyLeg({ id: 'mny-txn-b', amount: '-1500.00' }),
      ],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-1500.00' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    suppressed_source_ids: ['mny-txn-a'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [{
      import_source_id: 'mny-txn-a', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', transfer_account_id: 'mny-acct-2',
      counterpart_source_id: null, counterpart_split_source_id: null,
      day_gap: 0, description_similarity: 0,
    }],
  },
};
