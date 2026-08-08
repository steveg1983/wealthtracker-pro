// The stricter rule wins. A transfer leg may be handed over; a split parent may
// not be suppressed at all, and a row that is both is the second thing.
import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'both kinds at once, and the one that refuses is the one that applies',
  design: 'src/services/import/msMoney/feedOverlap.ts:256-280 — the pool test reads isSplit first',
  consequence: 'handing over a split parent would orphan its lines AND be refused by the '
    + 'database, in that order',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyLeg({ id: 'mny-txn-out', amount: '-1500.00', is_split: true })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-1500.00' })],
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
