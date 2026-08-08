import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'one is a duplicate of the imported row; the other is spending the file never had',
  design: 'src/services/import/msMoney/feedOverlap.ts:21-25 — strictly 1:1 and greedy',
  consequence: 'at most feedRows.length Money rows can ever be dropped, and that bound is the '
    + 'whole safety argument',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '-9.99' })],
      feed_rows: [
        feedRow({ id: 'feed-1', amount: '-9.99' }),
        feedRow({ id: 'feed-2', amount: '-9.99' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [{
      import_source_id: 'mny-txn-1', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0.5,
      is_transfer_handover: false,
    }],
    suppressed_source_ids: ['mny-txn-1'],
    unmatched_feed_ids: ['feed-2'],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
