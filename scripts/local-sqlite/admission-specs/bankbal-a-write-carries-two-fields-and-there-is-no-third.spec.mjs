// The whole safety argument, executed. `balance` is the ledger the imported
// transactions have ALREADY moved; writing the statement's total on top of it
// would count the same money twice. The TypeScript makes that a type —
// `Pick<Account,'bankBalance'|'bankBalanceDate'>` — and the port makes it a
// struct with two private fields and one constructor.
export default {
  invariant: 'TS-B3',
  title: 'the update names bankBalance and its date, and nothing else exists to name',
  design: 'src/utils/statementBankBalance.ts:14-21, :43-44; '
    + 'crates/wealth-core/src/admission/statement_bank_balance.rs',
  consequence: 'a statement total added to the ledger balance double-counts every transaction '
    + 'in the file that has just been imported',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '500.00', date_as_of: '2026-03-31' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    // Asserted as the WHOLE object, so a third key could not appear unnoticed.
    updates: { bank_balance: '500.00', bank_balance_date: '2026-03-31' },
  },
};
