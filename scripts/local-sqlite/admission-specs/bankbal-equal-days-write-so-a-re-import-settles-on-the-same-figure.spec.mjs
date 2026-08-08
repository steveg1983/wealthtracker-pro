export default {
  invariant: 'TS-B1',
  title: 'the same day may write, so the answer does not depend on the order files were opened in',
  design: 'src/utils/statementBankBalance.ts:113-116 — the comparison is strictly greater-than',
  consequence: 're-importing one statement twice would otherwise settle on whichever copy was '
    + 'opened first, which is not a property anybody can reason about',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-03-31' },
      account: { bank_balance: '900.00', bank_balance_date: '2026-03-31' },
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
