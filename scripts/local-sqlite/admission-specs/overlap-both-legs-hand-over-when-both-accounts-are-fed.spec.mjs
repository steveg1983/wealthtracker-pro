import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'two legs, two feed rows, and the pair ends up pointing at each other',
  design: 'src/services/import/msMoney/feedOverlap.ts:32-45',
  consequence: 'handing over one side and not the other is exactly the one-sided transfer the '
    + 'whole rule exists to avoid',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [
        moneyLeg({ id: 'mny-txn-out', amount: '-1500.00', account_id: 'mny-acct-1', transfer_account_id: 'mny-acct-2', linked_transfer_id: 'mny-txn-in' }),
        moneyLeg({ id: 'mny-txn-in', amount: '1500.00', account_id: 'mny-acct-2', transfer_account_id: 'mny-acct-1', linked_transfer_id: 'mny-txn-out' }),
      ],
      feed_rows: [
        feedRow({ id: 'feed-out', amount: '-1500.00', account_id: 'mny-acct-1' }),
        feedRow({ id: 'feed-in', amount: '1500.00', account_id: 'mny-acct-2' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [
      {
        import_source_id: 'mny-txn-out', feed_transaction_id: 'feed-out',
        account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0,
        is_transfer_handover: true,
      },
      {
        import_source_id: 'mny-txn-in', feed_transaction_id: 'feed-in',
        account_id: 'mny-acct-2', day_gap: 0, description_similarity: 0,
        is_transfer_handover: true,
      },
    ],
    suppressed_source_ids: ['mny-txn-out', 'mny-txn-in'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [
      {
        import_source_id: 'mny-txn-out', feed_transaction_id: 'feed-out',
        account_id: 'mny-acct-1', transfer_account_id: 'mny-acct-2',
        counterpart_source_id: 'mny-txn-in', counterpart_split_source_id: null,
        day_gap: 0, description_similarity: 0,
      },
      {
        import_source_id: 'mny-txn-in', feed_transaction_id: 'feed-in',
        account_id: 'mny-acct-2', transfer_account_id: 'mny-acct-1',
        counterpart_source_id: 'mny-txn-out', counterpart_split_source_id: null,
        day_gap: 0, description_similarity: 0,
      },
    ],
  },
};
