// Zero is falsy, and every "does the file state a balance?" test has to ask
// whether the BALANCE is absent, never whether the AMOUNT is truthy. An account
// on a nightly two-way sweep to a linked savings account closes at exactly 0.00
// every day; skipping it would leave Reconciliation with nothing to check
// against on the one account that always states its position exactly.
export default {
  invariant: 'TS-B1',
  title: 'a statement that closes at zero writes zero',
  design: 'src/utils/statementBankBalance.ts:131-137 — the test is on the OBJECT, not the number',
  consequence: 'the swept account — the one whose position is always exactly known — is the one '
    + 'left with no reference to reconcile against',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '0.00', date_as_of: '2026-03-31' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    kind: 'set',
    updates: { bank_balance: '0.00', bank_balance_date: '2026-03-31' },
    amount: '0.00',
    date_as_of: '2026-03-31',
  },
};
