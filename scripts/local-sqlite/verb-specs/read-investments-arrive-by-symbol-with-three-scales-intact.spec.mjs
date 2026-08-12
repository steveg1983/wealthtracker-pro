import {
  USER, EVERYDAY, LISTED_HOLDING, SECOND_HOLDING, OPENED_SECOND,
  twoHoldings, listedInvestment, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-1',
  title: 'the holdings come back by symbol, with quantity and prices at eight places and the cost at two',
  design: 'InvestmentService.list: .select(SELECTED_COLUMNS).eq(\'user_id\', …).order(\'symbol\', { ascending: true }). Thirteen columns in one string literal, plus user_id, which every row struct under crate::row carries',
  consequence: 'a share price is a RATE, not an amount: numeric(10,2) turned £32.775 into £32.78 on every write until migration 20260809120000, which is half a penny a share every night in the same direction. An engine that rendered a quantity or a price with the money helper would reintroduce exactly that',
  parity: 'match',

  setup: twoHoldings,
  command: { verb: 'list_investments', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    investments: [
      listedInvestment({
        id: LISTED_HOLDING, account_id: EVERYDAY, symbol: 'AAAA.L',
        name: 'A Listed Company plc', asset_type: 'stock', currency: 'GBP',
        quantity: '100.00000000', cost_basis: '3277.50',
        current_price: '40.00000000', purchase_date: '2024-06-01',
        purchase_price: '32.77500000', last_updated: '2024-06-30T17:00:00.000Z',
        notes: 'held in the ISA',
      }),
      listedInvestment({
        id: SECOND_HOLDING, account_id: EVERYDAY, symbol: 'BBBB.L',
        name: 'Another Company plc', asset_type: 'etf', currency: 'GBP',
        // NEVER PRICED, which a UI must be able to tell from worth nothing.
        quantity: '5.00000000', cost_basis: '250.00',
      }),
    ],
  },
  state: [balanceIdentityHolds(EVERYDAY), auditRowsInTotal('0')],
};
