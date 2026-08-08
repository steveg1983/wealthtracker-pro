import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'the Money row the feed already covers is not imported',
  design: 'src/services/import/msMoney/feedOverlap.ts:1-30; TS-INVARIANTS §1.2 TS-I12',
  consequence: 'every payment in the window where a Money file and a live feed overlap is '
    + 'counted twice in every report',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '-12.34' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-12.34' })],
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
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
