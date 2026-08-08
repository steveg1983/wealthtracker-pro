import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'feeds post on the settlement date and Money records the transaction date',
  design: 'src/services/import/msMoney/feedOverlap.ts:17-26',
  consequence: 'a window that demanded the same day would miss most of the overlap and '
    + 'double it instead',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '-50.00', date: '2026-05-10' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-50.00', date: '2026-05-12' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [{
      import_source_id: 'mny-txn-1', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', day_gap: 2, description_similarity: 0.5,
      is_transfer_handover: false,
    }],
    suppressed_source_ids: ['mny-txn-1'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
