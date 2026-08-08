import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'same day, same amount, and the closer wording is the one suppressed',
  design: 'src/services/import/msMoney/feedOverlap.ts:222-227 — description ranks, never gates',
  consequence: 'the tie-break is the only thing that makes a same-day pair deterministic; '
    + 'without it the answer depends on the order the file was read in',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [
        moneyRow({ id: 'mny-txn-a', amount: '-20.00', description: 'Fuel Station' }),
        moneyRow({ id: 'mny-txn-b', amount: '-20.00', description: 'Corner Shop' }),
      ],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-20.00' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [{
      import_source_id: 'mny-txn-b', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0.5,
      is_transfer_handover: false,
    }],
    suppressed_source_ids: ['mny-txn-b'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
