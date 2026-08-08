import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'the feed covers it, and it is kept anyway — and counted, so the residual is visible',
  design: 'src/services/import/msMoney/feedOverlap.ts:54-59, :345-356',
  consequence: 'a split parent\'s category breakdown lives in child rows the feed has no '
    + 'equivalent for; dropping the parent orphans the split',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '-80.00', is_split: true })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-80.00' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [],
    suppressed_source_ids: [],
    unmatched_feed_ids: ['feed-1'],
    kept_despite_overlap: { transfers: 0, split_parents: 1 },
    transfer_handovers: [],
  },
};
