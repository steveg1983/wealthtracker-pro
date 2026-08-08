import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: 'the same amount on the same day in another account is another transaction',
  design: 'src/services/import/msMoney/feedOverlap.ts:256-267 — the index key is account + pence',
  consequence: 'suppressing across accounts deletes one half of a transfer',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '-12.34' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-12.34', account_id: 'mny-acct-9' })],
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
