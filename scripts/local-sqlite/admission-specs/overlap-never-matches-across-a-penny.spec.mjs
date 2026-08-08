import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'a penny of difference is a different payment',
  design: 'src/services/import/msMoney/feedOverlap.ts:159-161 — exact pence, no float anywhere',
  consequence: 'a near-miss suppressed is spending removed from the record for good',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '-12.34' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-12.35' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [],
    suppressed_source_ids: [],
    unmatched_feed_ids: ['feed-1'],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
