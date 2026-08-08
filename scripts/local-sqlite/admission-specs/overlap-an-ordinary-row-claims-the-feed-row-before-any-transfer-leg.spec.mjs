// The two passes are in this order for this reason: adding the second cannot
// move a single pairing the first used to make. A feed row only reaches the
// transfer pool once nothing ordinary wanted it.
import { feedRow, moneyLeg, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'pass 1 is ordinary rows, and it runs first so nothing it used to do can change',
  design: 'src/services/import/msMoney/feedOverlap.ts:238-248',
  consequence: 'a handover that stole a feed row from an ordinary match would rewrite a '
    + 'transfer AND leave the ordinary duplicate in place — two wrongs from one reordering',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [
        moneyRow({ id: 'mny-txn-ordinary', amount: '-1500.00', description: 'Corner Shop' }),
        moneyLeg({ id: 'mny-txn-transfer', amount: '-1500.00' }),
      ],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-1500.00' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    suppressed_source_ids: ['mny-txn-ordinary'],
    transfer_handovers: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    unmatched_feed_ids: [],
  },
};
