export default {
  invariant: 'MONEY-1',
  title: 'ninety-nine million and ninety-nine pence, unaltered',
  design: 'src/utils/statementBankBalance.ts:149-151; crates/wealth-core/src/money.rs',
  consequence: 'a figure that drifts by a penny is a Difference the user cannot reconcile away',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '99999999.99', date_as_of: '2026-03-31' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    kind: 'set',
    updates: { bank_balance: '99999999.99', bank_balance_date: '2026-03-31' },
    amount: '99999999.99',
    date_as_of: '2026-03-31',
  },
};
