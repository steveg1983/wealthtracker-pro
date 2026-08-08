import { moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'an account with no feed history suppresses nothing',
  design: 'src/services/import/msMoney/feedOverlap.ts:250-292',
  consequence: 'this is the ordinary case — most accounts have never been linked — and it must '
    + 'cost the import nothing at all',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '-1.00' })],
      feed_rows: [],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [],
    suppressed_source_ids: [],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
