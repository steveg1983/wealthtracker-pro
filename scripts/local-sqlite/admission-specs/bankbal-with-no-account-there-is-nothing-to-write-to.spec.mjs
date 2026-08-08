export default {
  invariant: 'TS-B1',
  title: 'a statement with no destination account is a no-op',
  design: 'src/utils/statementBankBalance.ts:128-130',
  consequence: 'a plan that described a write with no target is a plan whose caller has to '
    + 'invent one',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-03-31' },
      account: null,
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: { kind: 'none' },
};
