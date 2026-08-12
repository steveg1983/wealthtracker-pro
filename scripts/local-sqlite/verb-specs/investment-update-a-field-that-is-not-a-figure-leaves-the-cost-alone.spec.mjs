import {
  USER, EVERYDAY, LISTED_HOLDING, twoHoldings,
  investmentShape, balanceIdentityHolds,
} from './_shared.mjs';

// The other half of the rule above, and the half a re-implementation is likelier
// to get wrong: a patch that names NEITHER figure must leave the cost exactly as
// it is — INCLUDING for a row whose stored cost disagrees with its own quantity
// and price, which a restore can bring and which an unrelated edit has no
// business silently correcting.
export default {
  invariant: 'B-3',
  title: 'renaming a holding does not recompute what it cost',
  design: 'InvestmentService.update:266-285 — the cost branch is guarded by `changes.quantity !== undefined || changes.averageCost !== undefined`; every other key writes its own column and nothing else',
  consequence: 'a store that recomputed on every edit would quietly rewrite the history of any row it had not written itself, and a restored ledger is exactly such a row',
  parity: 'match',

  setup: twoHoldings,
  command: {
    verb: 'update_investment',
    payload: {
      id: LISTED_HOLDING,
      user_id: USER,
      patch: { name: 'A Listed Company', notes: 'moved to the dealing account' },
    },
  },

  expect: { outcome: 'ok' },
  rowDivergence: { updated_at: 'the instant of the write, on two clocks' },

  result: {
    id: LISTED_HOLDING,
    user_id: USER,
    account_id: EVERYDAY,
    symbol: 'AAAA.L',
    name: 'A Listed Company',
    asset_type: 'stock',
    currency: 'GBP',
    quantity: '100.00000000',
    cost_basis: '3277.50',
    current_price: '40.00000000',
    purchase_date: '2024-06-01',
    purchase_price: '32.77500000',
    last_updated: '2024-06-30T17:00:00.000Z',
    notes: 'moved to the dealing account',
  },

  state: [
    investmentShape(
      LISTED_HOLDING,
      'AAAA.L:A Listed Company:100.00000000:3277.50:40.00000000:32.77500000:stock:GBP:2024-06-01:0001:moved to the dealing account'
    ),
    balanceIdentityHolds(EVERYDAY),
  ],
};
