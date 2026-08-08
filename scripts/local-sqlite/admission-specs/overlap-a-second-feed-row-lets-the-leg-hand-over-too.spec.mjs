import { feedRow, moneyLeg, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'with a feed row each, the ordinary row and the leg are both covered — still 1:1',
  design: 'src/services/import/msMoney/feedOverlap.ts:238-248',
  consequence: 'the ordering rule must not cost the leg its handover when there is a feed row '
    + 'going spare; that would leave the largest row in the window duplicated',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [
        moneyRow({ id: 'mny-txn-ordinary', amount: '-1500.00', description: 'Corner Shop' }),
        moneyLeg({ id: 'mny-txn-transfer', amount: '-1500.00' }),
      ],
      feed_rows: [
        feedRow({ id: 'feed-1', amount: '-1500.00' }),
        feedRow({ id: 'feed-2', amount: '-1500.00' }),
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    suppressed_source_ids: ['mny-txn-ordinary', 'mny-txn-transfer'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [{
      import_source_id: 'mny-txn-transfer', feed_transaction_id: 'feed-2',
      account_id: 'mny-acct-1', transfer_account_id: 'mny-acct-2',
      counterpart_source_id: null, counterpart_split_source_id: null,
      day_gap: 0, description_similarity: 0,
    }],
  },
};
