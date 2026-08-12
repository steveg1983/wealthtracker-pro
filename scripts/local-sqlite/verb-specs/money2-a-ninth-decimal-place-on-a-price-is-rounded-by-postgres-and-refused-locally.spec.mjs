import {
  USER, EVERYDAY, NEW_HOLDING,
  investmentShape, holdingsOwnedBy, balanceIdentityHolds,
} from './_shared.mjs';

// M-1 ONE SCALE OUT, and the declared divergence this family arrived with.
//
// `investments.quantity`, `.current_price` and `.purchase_price` are
// numeric(20,8) in the cloud, so a ninth decimal place is ROUNDED half-away-from-
// zero and nothing says a word — exactly what numeric(10,2) did to LSE prices
// until migration 20260809120000, one scale further in. The local columns are
// INTEGER counts of hundred-millionths, so `crate::scaled` refuses the input
// instead and writes nothing.
//
// The principle is DESIGN.md §3.1's, which states it about this very quantity:
// *"the local edition refuses to write it rather than silently rounding"*.
//
// WHY IT MATTERS AT A SCALE NOBODY TRADES AT. It is not about the ninth digit.
// It is that "refuse rather than round" has to hold at whatever scale a column
// has, or the rule is a habit that stops one place short of wherever the next
// column is — and the price column is the one that had a real, measured,
// nightly rounding bug in production.
export default {
  invariant: 'MONEY-2',
  title: 'nine decimal places on a unit price: Postgres rounds it away silently, the local file refuses it',
  design: 'DESIGN.md §3.1 (refuse rather than round); numeric(20,8) since 20260809120000_investment_prices_below_the_penny.sql; crate::scaled::from_decimal_string returns TooPrecise',
  consequence: 'a unit price is a RATE, and rounding a rate before multiplying it by a quantity is the classic way to make a portfolio disagree with the broker — this is the same failure the cloud already had at two places, refused rather than repeated at eight',
  parity: 'divergent',
  reason:
    'Postgres stores 32.77500001 rounded to eight places and reports nothing, because the column is numeric(20,8). '
    + 'The local Scaled8 boundary refuses the input, so no row is written at all. DECIDED, not accidental: DESIGN.md §3.1, '
    + 'the same ruling MONEY-1 records for numeric(20,2). The divergence must be resolved on the cloud side (reject or '
    + 'report the rounding) before an importer can rely on either behaviour.',

  command: {
    verb: 'create_investment',
    payload: {
      id: NEW_HOLDING,
      user_id: USER,
      account_id: EVERYDAY,
      symbol: 'AAAA.L',
      name: 'A Listed Company plc',
      quantity: '1',
      purchase_price: '32.775000005',
      currency: 'GBP',
      asset_type: 'stock',
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'figure_not_representable' },
    postgres: { outcome: 'ok' },
  },

  state: [
    investmentShape(NEW_HOLDING, {
      sqlite: 'GONE',
      // Rounded away, and the row reads as though 32.77500001 is what was asked
      // for. The cost basis is then derived from the rounded figure.
      postgres: 'AAAA.L:A Listed Company plc:1.00000000:32.78:-:32.77500001:stock:GBP:-:0001:-',
    }),
    holdingsOwnedBy(USER, { sqlite: '0', postgres: '1' }),
    balanceIdentityHolds(EVERYDAY),
  ],
};
