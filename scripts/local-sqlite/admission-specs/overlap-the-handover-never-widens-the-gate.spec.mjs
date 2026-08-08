import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'a leg outside the window is not handed over, however large it is',
  design: 'src/services/import/msMoney/feedOverlap.ts:46-52 — "it fires only on a pairing that '
    + 'already qualifies"',
  consequence: 'the handover is the one part of this rule that REWRITES a transfer rather than '
    + 'dropping a row; widening the gate for it would rewrite pairs on a guess',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyLeg({ id: 'mny-txn-out', amount: '-1500.00', date: '2026-05-10' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-1500.00', date: '2026-05-20' })],
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
