// Catching up on paperwork: March's statement opened after November's.
export default {
  invariant: 'TS-B1',
  title: 'an older statement does not overwrite a newer figure, and says which one it kept',
  design: 'src/utils/statementBankBalance.ts:109-118',
  consequence: 'reopening Reconciliation would show a difference of several months\' spending, '
    + 'and finalising it would be worse than useless',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-03-31' },
      account: { bank_balance: '4200.00', bank_balance_date: '2026-11-30' },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: { kind: 'stale', recorded_date: '2026-11-30', recorded_balance: '4200.00' },
};
