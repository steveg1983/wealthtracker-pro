// A DECLARED DIVERGENCE — the same one, at the third and last of its sites.
//
// The Vitest suite's own case is `0.1 + 0.2`, whose value is
// 0.30000000000000004, and its point is that `pence()` puts both sides on 30p
// through Decimal. Written as text here, because the payload is one document:
// `Number("0.30000000000000004")` reproduces that double exactly.
//
// The port never sees a double — Money is an i64 — so the defence has nothing
// to defend against, and the input it cannot represent is refused rather than
// rounded. Both behaviours are pinned so the divergence cannot drift.
import { feedRow, moneyRow } from './_shared.mjs';

export default {
  invariant: 'MONEY-1',
  title: 'float drift: absorbed by the module\'s Decimal round-trip, refused by the port\'s type',
  design: 'src/services/import/msMoney/feedOverlap.ts:159-161; crates/wealth-core/src/money.rs',
  consequence: 'a rounded amount is a match against a figure nobody sent — and here the '
    + 'consequence of a wrong match is a Money row that is never imported',
  parity: 'divergent',
  reason: 'pence() rounds half away from zero after a Decimal round-trip; Money::parse refuses '
    + 'more than two decimal places outright',

  command: {
    verb: 'plan_feed_overlap',
    payload: {
      transactions: [moneyRow({ id: 'mny-txn-1', amount: '0.30000000000000004' })],
      feed_rows: [feedRow({ id: 'feed-1', amount: '0.30' })],
    },
  },

  expect: {
    typescript: { outcome: 'ok' },
    rust: { outcome: 'refused', error: 'amount_not_representable' },
  },
  result: {
    matches: [{
      import_source_id: 'mny-txn-1', feed_transaction_id: 'feed-1',
      account_id: 'mny-acct-1', day_gap: 0, description_similarity: 0.5,
      is_transfer_handover: false,
    }],
    suppressed_source_ids: ['mny-txn-1'],
  },
};
