export default {
  invariant: 'TS-B1',
  title: 'a balance that predates the date column is undatable, so it is replaceable',
  design: 'src/utils/statementBankBalance.ts:120-122',
  consequence: 'the alternative is refusing forever on every account whose figure was recorded '
    + 'before there was a column to date it',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-03-31' },
      account: { bank_balance: '100.00', bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    kind: 'set',
    updates: { bank_balance: '900.00', bank_balance_date: '2026-03-31' },
    amount: '900.00',
    date_as_of: '2026-03-31',
  },
};
