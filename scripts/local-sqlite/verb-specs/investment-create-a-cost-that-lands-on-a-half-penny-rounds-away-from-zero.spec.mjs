import {
  USER, EVERYDAY, NEW_HOLDING,
  investmentShape, marketValuesStored, balanceIdentityHolds,
} from './_shared.mjs';

// THE ROUNDING MODE, which is the one thing about the derived cost that a
// re-implementation could get plausibly wrong.
//
// 3 units at £12.345 is £37.035 exactly — a figure that is representable at
// eight places and NOT at two, so somebody has to decide. numeric(10,2) rounds
// half-AWAY-FROM-ZERO on the way in; `crate::scaled::market_value_minor` does
// the same in i128 and says why it is not half-up: a half-up implementation
// answers −£37.03 for the short side and the two ledgers are then a penny apart
// on every short position that lands on a half.
export default {
  invariant: 'M-1',
  title: 'a cost of exactly half a penny rounds away from zero, on both engines',
  design: 'numeric(10,2) rounds the product of Decimal.times() half-away-from-zero on insert; crate::scaled::market_value_minor reproduces that in i128 rather than inheriting a language default',
  consequence: 'cost basis is what a gain is measured against, so a penny decided differently by the two engines is a portfolio that reports a different profit depending on which edition opened it',
  parity: 'match',

  command: {
    verb: 'create_investment',
    payload: {
      id: NEW_HOLDING,
      user_id: USER,
      account_id: EVERYDAY,
      symbol: 'FUND.L',
      name: 'A Fund',
      quantity: '3',
      purchase_price: '12.345',
      currency: 'GBP',
      asset_type: 'mutual_fund',
    },
  },

  expect: { outcome: 'ok' },

  result: {
    id: NEW_HOLDING,
    user_id: USER,
    account_id: EVERYDAY,
    symbol: 'FUND.L',
    name: 'A Fund',
    asset_type: 'mutual_fund',
    currency: 'GBP',
    quantity: '3.00000000',
    // 37.035 → 37.04, not 37.03.
    cost_basis: '37.04',
    current_price: null,
    purchase_date: null,
    purchase_price: '12.34500000',
    last_updated: null,
    notes: null,
  },

  state: [
    investmentShape(NEW_HOLDING, 'FUND.L:A Fund:3.00000000:37.04:-:12.34500000:mutual_fund:GBP:-:0001:-'),
    marketValuesStored('0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
