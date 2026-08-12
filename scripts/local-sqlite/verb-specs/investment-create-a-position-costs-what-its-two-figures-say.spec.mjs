import {
  USER, EVERYDAY, NEW_HOLDING,
  investmentShape, holdingsOwnedBy, marketValuesStored, balanceIdentityHolds,
} from './_shared.mjs';

// THE FIGURE NEITHER ENGINE TAKES FROM A CALLER. `cost_basis` is quantity ×
// averageCost, computed by whoever is writing, and the writer's own comment says
// why it is not a column a payload can set: *"two numbers that must agree are
// two numbers that will not."*
//
// The arithmetic is where the two engines could most easily disagree and do not:
// the cloud multiplies with Decimal and lets numeric(10,2) round the product;
// the crate multiplies in i128 and rounds half-away-from-zero itself, because
// that is what Postgres does to the same product. 100 × 32.775 is exact, so this
// spec is about the derivation; the rounding has its own spec beside it.
export default {
  invariant: 'B-3',
  title: 'a new holding costs quantity × unit price, and no payload can say otherwise',
  design: 'InvestmentService.create:229 — `const costBasis = draft.quantity.times(draft.averageCost)` — then insert({quantity, cost_basis: costBasis, purchase_price: draft.averageCost, …}). No RPC: investments is written straight over PostgREST (PHASE3-PLAN D-2)',
  consequence: 'a position whose stored cost disagrees with its own quantity and price is a row describing something nobody ever held, and every gain figure drawn from it is wrong in a direction nothing on screen explains',
  parity: 'match',

  command: {
    verb: 'create_investment',
    payload: {
      id: NEW_HOLDING,
      user_id: USER,
      account_id: EVERYDAY,
      symbol: 'AAAA.L',
      name: 'A Listed Company plc',
      quantity: '100',
      purchase_price: '32.775',
      purchase_date: '2024-06-01',
      currency: 'GBP',
      asset_type: 'stock',
    },
  },

  expect: { outcome: 'ok' },

  result: {
    id: NEW_HOLDING,
    user_id: USER,
    account_id: EVERYDAY,
    symbol: 'AAAA.L',
    name: 'A Listed Company plc',
    asset_type: 'stock',
    currency: 'GBP',
    quantity: '100.00000000',
    // DERIVED. Not in the payload above, and there is no key for it.
    cost_basis: '3277.50',
    // A price comes from an exchange, never from a create.
    current_price: null,
    purchase_date: '2024-06-01',
    purchase_price: '32.77500000',
    last_updated: null,
    notes: null,
  },

  state: [
    investmentShape(
      NEW_HOLDING,
      'AAAA.L:A Listed Company plc:100.00000000:3277.50:-:32.77500000:stock:GBP:2024-06-01:0001:-'
    ),
    holdingsOwnedBy(USER, '1'),
    // The column both schemas have and neither engine writes.
    marketValuesStored('0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
