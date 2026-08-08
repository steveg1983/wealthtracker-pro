export default {
  invariant: 'TS-B1',
  title: 'February\'s recorded balance gives way to March\'s statement',
  design: 'src/utils/statementBankBalance.ts:109-122',
  consequence: 'refusing to move forward leaves Reconciliation checking against a figure that '
    + 'is months out of date',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-03-31' },
      account: { bank_balance: '100.00', bank_balance_date: '2026-02-28' },
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
