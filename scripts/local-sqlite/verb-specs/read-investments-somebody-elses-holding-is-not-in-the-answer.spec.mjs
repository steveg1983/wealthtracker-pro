import {
  USER, EVERYDAY, LISTED_HOLDING, SECOND_HOLDING,
  secondUser, setups, twoHoldings, strangersHolding, listedInvestment,
  holdingsOwnedBy, balanceIdentityHolds,
} from './_shared.mjs';

export default {
  invariant: 'R-12',
  title: 'a second login’s holding of the same security is not in this login’s portfolio',
  design: 'every cloud read is .eq(\'user_id\', userId); locally there is no RLS to narrow an answer afterwards and a file CAN hold two logins’ rows — a restored backup from an account that had two',
  consequence: 'a holding rolls up into a portfolio figure, so one belonging to somebody else moves a number nobody can explain — which is why schema.sql gives this table the R-12 composite key as well as the owner column',
  parity: 'match',

  setup: setups(secondUser, twoHoldings, strangersHolding),
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
        quantity: '5.00000000', cost_basis: '250.00',
      }),
    ],
  },
  state: [
    holdingsOwnedBy(USER, '2'),
    // Still there, untouched, in the same file.
    holdingsOwnedBy('22222222-2222-2222-2222-222222222222', '1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
