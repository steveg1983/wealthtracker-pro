// The Money row's amount reaches the rule as a JavaScript number and the feed
// row's as text; both go through Decimal to exact pence, so "0.30" and "0.3"
// are the same 30p on both implementations. In the port they are the same i64
// before either is compared.
import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'TS-I12',
  title: '0.30 and 0.3 are one amount, not two',
  design: 'src/services/import/msMoney/feedOverlap.ts:159-161',
  consequence: 'a string comparison here would miss every pairing whose two systems wrote the '
    + 'same figure with different trailing zeros',
  parity: 'match',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '0.30' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '0.3' })],
    },
  },

  expect: { outcome: 'ok' },
  result: {
    matches: [{
      import_source_id: 'mny-txn-1', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0.5,
      is_transfer_handover: false,
    }],
    suppressed_source_ids: ['mny-txn-1'],
    unmatched_feed_ids: [],
    kept_despite_overlap: { transfers: 0, split_parents: 0 },
    transfer_handovers: [],
  },
};
