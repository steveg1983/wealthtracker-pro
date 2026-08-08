import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'a leg with nothing on the other side has nothing to strand',
  design: 'src/services/import/msMoney/feedOverlap.ts:271-278 — the link columns default to null',
  consequence: 'refusing the handover here would keep a duplicate for the sake of a counterpart '
    + 'that does not exist',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyLeg({ id: 'mny-txn-out', amount: '-75.00', transfer_account_id: null })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-75.00' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    suppressed_source_ids: ['mny-txn-out'],
    transfer_handovers: [{
      import_source_id: 'mny-txn-out', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', transfer_account_id: null,
      counterpart_source_id: null, counterpart_split_source_id: null,
      day_gap: 0, description_similarity: 0,
    }],
  },
};
