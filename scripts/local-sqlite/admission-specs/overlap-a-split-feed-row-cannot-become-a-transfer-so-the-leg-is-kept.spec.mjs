import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'the pairing qualifies, and the handover is refused because the database would refuse it',
  design: 'src/services/import/msMoney/feedOverlap.ts:46-52, :313-321 — '
    + 'protect_split_transaction_fields rejects re-typing a split parent',
  consequence: 'suppressing the leg anyway would drop a real payment whose replacement the '
    + 'database will not accept — and the leg is COUNTED, so the residual is visible',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyLeg({ id: 'mny-txn-out', amount: '-1500.00', linked_transfer_id: 'mny-txn-in' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '-1500.00', is_split: true })],
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
