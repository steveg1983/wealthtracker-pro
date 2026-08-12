import {
  USER, EVERYDAY, LISTED_HOLDING, SECOND_HOLDING, twoHoldings,
  investmentShape, marketValuesStored, balanceIdentityHolds,
} from './_shared.mjs';

// A QUOTE IS ABOUT A SECURITY, NOT ABOUT A POSITION. The same fund held in an
// ISA and a dealing account is two rows and one price, so both engines match on
// `(user_id, symbol)` — pricing them separately would fetch the same quote twice
// and leave the second row stale whenever the first fetch failed.
//
// This is also the one verb of the family whose SHAPE differs: the cloud loops a
// PostgREST update per quote and the crate writes them in one transaction. What
// is compared is the promise — the rows carry the prices and the count is rows
// REPRICED — which is why the harness sends one list to both.
export default {
  invariant: 'B-3',
  title: 'a price lands on every holding of that symbol, and the count is rows rather than quotes',
  design: 'InvestmentService.applyQuotes:335-352 — one .update({current_price, last_updated, updated_at}).eq(\'user_id\',…).eq(\'symbol\',…).select(\'id\') per quote, summing data?.length',
  consequence: 'the caller renders this number ("3 of 5 updated"), so an engine that answered quotes.length would be putting a claim it never verified in front of somebody watching a portfolio reprice',
  parity: 'match',

  setup: twoHoldings,
  command: {
    verb: 'apply_investment_prices',
    payload: {
      user_id: USER,
      quotes: [
        { symbol: 'BBBB.L', price: '52.375', as_of: '2026-08-11T16:35:00.000Z' },
        // A security nobody holds contributes ZERO. That is what makes the
        // sentence above honest rather than a count of what was attempted.
        { symbol: 'NOBODY.L', price: '1.00', as_of: '2026-08-11T16:35:00.000Z' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { repriced: 1 },

  state: [
    // The row that was never priced now is, to eight places — the third decimal
    // that numeric(10,2) used to round away.
    investmentShape(
      SECOND_HOLDING,
      'BBBB.L:Another Company plc:5.00000000:250.00:52.37500000:-:etf:GBP:-:0001:-'
    ),
    // And the other security was not touched by a quote that was not about it.
    investmentShape(
      LISTED_HOLDING,
      'AAAA.L:A Listed Company plc:100.00000000:3277.50:40.00000000:32.77500000:stock:GBP:2024-06-01:0001:held in the ISA'
    ),
    // Still nobody's business to store: value is quantity × price, computed.
    marketValuesStored('0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
