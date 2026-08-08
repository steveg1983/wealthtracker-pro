import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'two eligible Money rows, and the one on the feed row\'s own day is chosen',
  design: 'src/services/import/msMoney/feedOverlap.ts:207-230 — pickBest',
  consequence: 'suppressing the wrong one of two equal payments leaves the register describing '
    + 'the right money on the wrong day',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [
        moneyRow({ id: 'mny-txn-far', amount: '-20.00', date: '2026-05-08', description: 'Corner Shop' }),
        moneyRow({ id: 'mny-txn-near', amount: '-20.00', date: '2026-05-10', description: 'Fuel Station' }),
      ],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-20.00', date: '2026-05-10' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [{
      import_source_id: 'mny-txn-near', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0,
      is_transfer_handover: false,
    }],
    suppressed_source_ids: ['mny-txn-near'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
