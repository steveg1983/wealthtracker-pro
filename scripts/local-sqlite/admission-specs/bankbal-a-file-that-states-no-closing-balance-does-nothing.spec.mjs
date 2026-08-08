export default {
  invariant: 'TS-B1',
  title: 'no statement balance, nothing to do, and nothing worth saying',
  design: 'src/utils/statementBankBalance.ts:131-137',
  consequence: 'inventing a figure from the transactions would be the ledger writing its own '
    + 'reference and reconciliation would always agree with itself',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: { kind: 'none' },
};
