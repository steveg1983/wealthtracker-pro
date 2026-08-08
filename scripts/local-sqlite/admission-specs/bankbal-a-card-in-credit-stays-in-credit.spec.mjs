// The other direction, and the reason the rule is "pass the sign through"
// rather than "cards are negative": an overpaid or refunded card closes
// positive, and forcing the sign would invent a debt.
export default {
  invariant: 'TS-I2',
  title: 'an overpaid card closes positive and stays positive',
  design: 'src/utils/statementBankBalance.ts:23-31',
  consequence: 'a normalisation applied "because cards are liabilities" invents a debt the '
    + 'user does not have',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '45.50', date_as_of: '2026-03-31' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    kind: 'set',
    updates: { bank_balance: '45.50', bank_balance_date: '2026-03-31' },
    amount: '45.50',
    date_as_of: '2026-03-31',
  },
};
