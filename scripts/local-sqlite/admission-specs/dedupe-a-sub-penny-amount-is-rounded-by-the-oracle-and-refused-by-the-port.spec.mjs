// A DECLARED DIVERGENCE, and the third site at which the same one appears.
//
// `exactPence` is `toDecimal(amount).times(100).round()`, and the configured
// rounding is ROUND_HALF_UP — so a statement quoting -12.345 is deduplicated as
// -1235 minor and nobody is told. `Money::parse` refuses it, exactly as it
// refuses it at the ledger boundary and exactly as `crates/.../money.rs`
// declares against Postgres's own silent numeric(20,2) rounding.
//
// Pinned from BOTH sides on purpose: the day the TypeScript stops rounding,
// this spec fails and the divergence is retired deliberately rather than
// quietly.
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'MONEY-1',
  title: 'three decimal places: rounded away by the module, refused by the port',
  design: 'src/utils/statementDuplicates.ts:142-152; crates/wealth-core/src/money.rs',
  consequence: 'a rounded amount is a comparison against a figure nobody sent, and the row it '
    + 'matches is not necessarily the row it describes',
  parity: 'divergent',
  reason: 'exactPence rounds half away from zero; Money::parse refuses to round money on the '
    + 'caller\'s behalf — DESIGN.md §3.1',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ amount: '-12.345', description: 'Card fee', fit_id: 'fit-1' })],
      held: [held({ id: 'fee', amount: '-12.35', description: 'Fee' })],
    },
  },

  expect: {
    typescript: { outcome: 'ok' },
    rust: { outcome: 'refused', error: 'amount_not_representable' },
  },
  result: {
    certain: [],
    possible: [{
      incoming_index: 0, fit_id: 'fit-1', held_id: 'fee',
      held_description: 'Fee', held_date: '2027-02-07', held_amount: '-12.35',
      held_cleared: false, basis: 'amount-and-date', day_gap: 0, description_similarity: 0.5,
    }],
  },
};
