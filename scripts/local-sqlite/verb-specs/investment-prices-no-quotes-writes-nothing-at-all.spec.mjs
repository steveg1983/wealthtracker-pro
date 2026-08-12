import {
  USER, EVERYDAY, LISTED_HOLDING, twoHoldings,
  investmentShape, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

// NOTHING IN, NOTHING OUT, AND NOTHING WRITTEN. `if (quotes.length === 0)
// return 0` is the writer's FIRST line, before it even asks for a client — an
// empty sweep is the ordinary case (every symbol failed to fetch), not a
// caller's mistake, and it must not be the thing that raises a refusal at
// somebody who pressed nothing.
export default {
  invariant: 'B-3',
  title: 'a sweep with no quotes reprices nothing and leaves no trail',
  design: 'InvestmentService.applyQuotes:331 — `if (quotes.length === 0) return 0`, before `requireClient`',
  consequence: 'the button that fetches prices runs this whether or not any quote came back; a refusal here would turn a failed fetch into an error about the store',
  parity: 'match',

  setup: twoHoldings,
  command: { verb: 'apply_investment_prices', payload: { user_id: USER, quotes: [] } },

  expect: { outcome: 'ok' },
  result: { repriced: 0 },

  state: [
    investmentShape(
      LISTED_HOLDING,
      'AAAA.L:A Listed Company plc:100.00000000:3277.50:40.00000000:32.77500000:stock:GBP:2024-06-01:0001:held in the ISA'
    ),
    auditRowsInTotal('0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
