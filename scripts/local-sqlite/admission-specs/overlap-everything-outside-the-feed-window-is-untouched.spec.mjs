import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'a decade of history before the feed existed is not the feed\'s to suppress',
  design: 'src/services/import/msMoney/feedOverlap.ts:7-12 — the overlap is a WINDOW',
  consequence: 'a Money file is a complete history and the feed backfills from the day the '
    + 'account was linked; only where the two windows meet is there anything to reconcile',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [
        moneyRow({ id: 'mny-txn-old', amount: '-30.00', date: '2015-01-01' }),
        moneyRow({ id: 'mny-txn-new', amount: '-30.00', date: '2026-05-10' }),
      ],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-30.00', date: '2026-05-10' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [{
      import_source_id: 'mny-txn-new', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0.5,
      is_transfer_handover: false,
    }],
    suppressed_source_ids: ['mny-txn-new'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
