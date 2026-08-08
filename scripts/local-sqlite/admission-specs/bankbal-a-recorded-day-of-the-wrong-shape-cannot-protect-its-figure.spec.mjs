// BEYOND THE VITEST SUITE. The staleness guard needs BOTH sides to be days it
// can order. A recorded date of the wrong shape is unusable, so the figure it
// dates is written over rather than defended — the same answer an undated
// figure gets, arrived at for the same reason.
export default {
  invariant: 'TS-B1',
  title: 'a recorded date the rule cannot order does not hold the figure back',
  design: 'src/utils/statementBankBalance.ts:141-147 — isIsoDay(recordedDate) is a condition '
    + 'of the staleness branch, not of the write',
  consequence: 'a malformed stored date that BLOCKED writes would freeze an account\'s '
    + 'reconciliation reference permanently, with nothing in the interface to explain it',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-03-31' },
      account: { bank_balance: '4200.00', bank_balance_date: '30 Nov 2026' },
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
