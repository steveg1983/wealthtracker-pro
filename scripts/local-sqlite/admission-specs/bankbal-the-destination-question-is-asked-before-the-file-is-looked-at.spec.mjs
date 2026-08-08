// BEYOND THE VITEST SUITE, and an ORDER rather than a value. The account and
// the confirmation are checked FIRST, so an unattended run answers "none" — not
// "stale" — even when there is a newer figure it could have talked about. A
// port that checked staleness first would leak the recorded balance and its
// date to a caller that had not established the file was this account's.
export default {
  invariant: 'TS-B2',
  title: 'an unconfirmed destination answers "nothing to do", not "your figure is newer"',
  design: 'src/utils/statementBankBalance.ts:128-137 — the destination gate precedes '
    + 'every read of the statement and of the account',
  consequence: 'answering "stale, and here is the figure I kept" tells an unattended importer '
    + 'about an account it has not established any right to',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-03-31' },
      account: { bank_balance: '4200.00', bank_balance_date: '2026-11-30' },
      destination_confirmed: false,
    },
  },

  expect: { outcome: 'ok' },
  result: { kind: 'none' },
};
