import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'when the other side is a split LINE, the line\'s own id crosses with the handover',
  design: 'src/services/import/msMoney/feedOverlap.ts:120-136 — TransferHandover carries '
    + 'counterpartSplitSourceId',
  consequence: 'a handover that named only the counterpart TRANSACTION would re-point the '
    + 'parent instead of the line, and T-10 compares amounts against the line',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyLeg({
        id: 'mny-txn-out', amount: '-75.00',
        linked_transfer_id: 'mny-txn-parent', linked_transfer_split_id: 'mny-split-9',
      })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-75.00' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    suppressed_source_ids: ['mny-txn-out'],
    transfer_handovers: [{
      import_source_id: 'mny-txn-out', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', transfer_account_id: 'mny-acct-2',
      counterpart_source_id: 'mny-txn-parent', counterpart_split_source_id: 'mny-split-9',
      day_gap: 0, description_similarity: 0,
    }],
  },
};
