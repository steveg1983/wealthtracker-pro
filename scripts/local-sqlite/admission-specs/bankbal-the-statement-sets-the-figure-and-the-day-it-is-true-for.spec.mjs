export default {
  invariant: 'TS-B1',
  title: 'a statement with a closing balance sets Bank Balance, dated by the statement',
  design: 'src/utils/statementBankBalance.ts:1-31; TS-INVARIANTS §1.4',
  consequence: 'without it Reconciliation shows Difference as N/A and finalising proves nothing',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '1234.56', date_as_of: '2026-03-31' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    kind: 'set',
    updates: { bank_balance: '1234.56', bank_balance_date: '2026-03-31' },
    amount: '1234.56',
    date_as_of: '2026-03-31',
  },
};
