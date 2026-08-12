import {
  USER, EVERYDAY, LISTED_HOLDING, twoHoldings,
  investmentShape, marketValuesStored, balanceIdentityHolds,
} from './_shared.mjs';

// THE READ IN FRONT OF THE WRITE, which is the whole verb. The cloud's own
// comment: *"Quantity and unit cost move cost_basis together or not at all —
// writing one without recomputing the other would leave the row describing a
// position that was never held."*
//
// The two engines get there differently and must agree: the cloud does a SECOND
// ROUND TRIP (`this.findOne`) and can therefore lose a race to a price refresh
// landing between its read and its write; the crate reads inside the transaction
// that writes. That difference is in the file's favour and is not observable
// from one command, which is why this spec asserts the OUTCOME rather than the
// mechanism.
export default {
  invariant: 'B-3',
  title: 'changing only the quantity recomputes the cost from the stored unit price',
  design: 'InvestmentService.update:275-285 — `if (changes.quantity !== undefined || changes.averageCost !== undefined)` reads the current row, then writes quantity, cost_basis AND purchase_price together',
  consequence: 'a holding whose cost no longer matches its own figures reports a gain that never happened, and nothing on the page says which of the two numbers is the lie',
  parity: 'match',

  setup: twoHoldings,
  command: {
    verb: 'update_investment',
    payload: {
      id: LISTED_HOLDING,
      user_id: USER,
      patch: { quantity: '200' },
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    // The row is re-stamped by whichever engine wrote it, on two clocks.
    updated_at: 'the instant of the write, on two clocks and in two transactions',
  },

  result: {
    id: LISTED_HOLDING,
    user_id: USER,
    account_id: EVERYDAY,
    symbol: 'AAAA.L',
    name: 'A Listed Company plc',
    asset_type: 'stock',
    currency: 'GBP',
    quantity: '200.00000000',
    // 200 × 32.775, from the STORED unit price the patch never mentioned.
    cost_basis: '6555.00',
    // Untouched: a quantity edit is not a price.
    current_price: '40.00000000',
    purchase_date: '2024-06-01',
    purchase_price: '32.77500000',
    last_updated: '2024-06-30T17:00:00.000Z',
    notes: 'held in the ISA',
  },

  state: [
    investmentShape(
      LISTED_HOLDING,
      'AAAA.L:A Listed Company plc:200.00000000:6555.00:40.00000000:32.77500000:stock:GBP:2024-06-01:0001:held in the ISA'
    ),
    marketValuesStored('0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
