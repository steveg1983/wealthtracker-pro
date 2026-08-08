import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'three identical Money rows and two feed rows leave one genuine copy standing',
  design: 'src/services/import/msMoney/feedOverlap.ts:21-25',
  consequence: 'collapsing a run of equal payments into one is the commonest way an overlap '
    + 'rule destroys real history',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [
        moneyRow({ id: 'mny-txn-1', amount: '-7.99' }),
        moneyRow({ id: 'mny-txn-2', amount: '-7.99' }),
        moneyRow({ id: 'mny-txn-3', amount: '-7.99' }),
      ],
      feed_rows: [
        feedRow({ id: 'feed-1', amount: '-7.99' }),
        feedRow({ id: 'feed-2', amount: '-7.99' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [
      {
        import_source_id: 'mny-txn-1', feed_transaction_id: 'feed-1',
        account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0.5,
        is_transfer_handover: false,
      },
      {
        import_source_id: 'mny-txn-2', feed_transaction_id: 'feed-2',
        account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0.5,
        is_transfer_handover: false,
      },
    ],
    suppressed_source_ids: ['mny-txn-1', 'mny-txn-2'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
