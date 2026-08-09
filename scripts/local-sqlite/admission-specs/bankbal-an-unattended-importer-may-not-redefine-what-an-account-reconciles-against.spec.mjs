// TS-B2. The batch importers match a file to an account by a digit or two in
// its NAME, and nobody sees the result before it is written. Those runs still
// import the transactions — individually visible, individually removable — they
// just do not get to redefine what the account reconciles against on a guess.
export default {
  invariant: 'TS-B2',
  title: 'a file whose destination nobody confirmed changes nothing',
  design: 'src/utils/statementBankBalance.ts:94-107 (the unattended importer this guarded against was deleted 2026-08-09; batch runs now go through the attended single-file dialogs)',
  consequence: 'a batch run silently repoints reconciliation at the wrong account\'s figure, '
    + 'and the only symptom is a Difference nobody can explain',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-03-31' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: false,
    },
  },

  expect: { outcome: 'ok' },
  result: { kind: 'none' },
};
