import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'ten days apart is two transactions, and the feed row is reported as one the file '
    + 'never had',
  design: 'src/services/import/msMoney/feedOverlap.ts:17-26 — DEFAULT_TOLERANCE_DAYS = 3',
  consequence: 'a wide window suppresses a genuine repeat — a false positive here DELETES '
    + 'real spending, which is why the rule is deliberately narrow',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '-50.00', date: '2026-05-10' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-50.00', date: '2026-05-20' })],
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
