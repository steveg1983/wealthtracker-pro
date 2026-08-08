import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'a feed row that already belongs to a transfer is not ours to re-point',
  design: 'src/services/import/msMoney/feedOverlap.ts:46-52, :313-321',
  consequence: 're-pointing it would break the pair it is already half of, which is a second '
    + 'transfer nobody asked about',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyLeg({ id: 'mny-txn-out', amount: '-1500.00', linked_transfer_id: 'mny-txn-in' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-1500.00', linked_transfer_id: 'other-row' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [],
    suppressed_source_ids: [],
    unmatched_feed_ids: ['feed-1'],
    kept_despite_overlap: { transfers: 1, split_parents: 0 },
    transfer_handovers: [],
  },
};
