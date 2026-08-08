// A day it cannot ORDER is a day it cannot protect a newer figure from.
export default {
  invariant: 'TS-B1',
  title: 'a statement dated 31/03/2026 states no day this rule can use',
  design: 'src/utils/statementBankBalance.ts:54-58, :131-137',
  consequence: 'a date that does not sort makes the staleness comparison meaningless, and the '
    + 'staleness comparison is the only thing protecting a newer figure',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '31/03/2026' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: { kind: 'none' },
};
