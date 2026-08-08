// TS-I13. A leg used to be exempt outright, on the reasoning that dropping one
// side strands the other. In a fed account that left the LARGEST rows in the
// window duplicated — card payments, standing transfers — because the feed
// reports them exactly like any other movement.
import { feedRow, moneyLeg } from './_shared.mjs';

export default {
  invariant: 'TS-I13',
  title: 'the leg is suppressed and the feed row is told what it has to inherit',
  design: 'src/services/import/msMoney/feedOverlap.ts:32-45; TS-INVARIANTS §1.2 TS-I13',
  consequence: 'acting on a handover is not optional: the counterpart\'s link now points at a '
    + 'row that will not be imported, so skipping it strands the other side',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyLeg({ id: 'mny-txn-out', amount: '-1500.00', linked_transfer_id: 'mny-txn-in' })],
      // Nothing in common with the Money side's wording — description is a
      // ranking signal, never a gate, and the handover must not need it.
      feed_rows: [feedRow({ id: 'feed-1', amount: '-1500.00', description: 'BANK TRANSFER OUT' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [{
      import_source_id: 'mny-txn-out', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0,
      is_transfer_handover: true,
    }],
    suppressed_source_ids: ['mny-txn-out'],
    // The feed row is USED, so it is no longer "spending the file never had",
    // and nothing is left in the residual.
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [{
      import_source_id: 'mny-txn-out', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', transfer_account_id: 'mny-acct-2',
      counterpart_source_id: 'mny-txn-in', counterpart_split_source_id: null,
      day_gap: 0, description_similarity: 0,
    }],
  },
};
