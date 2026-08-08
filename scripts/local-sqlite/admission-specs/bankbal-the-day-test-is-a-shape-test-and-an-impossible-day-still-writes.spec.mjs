// BEYOND THE VITEST SUITE, and a finding rather than a flourish. `isIsoDay` is
// `/^\d{4}-\d{2}-\d{2}$/` — a SHAPE test, not a calendar one — so 45 March
// passes it and is written. That is faithfully ported, and deliberately, because
// the schema's own column check is `bank_balance_date LIKE '____-__-__'`
// (schema.sql:357): a port that refused this would refuse a value the file
// itself would store, and the two would disagree about what is writable.
//
// It is also harmless where it matters: the field is a REFERENCE the app
// compares against, never something it adds to, and a nonsense day sorts
// consistently for exactly as long as the next real statement takes to arrive.
export default {
  invariant: 'TS-B1',
  title: '2026-13-45 has the shape of a day, and the shape is what is tested',
  design: 'src/utils/statementBankBalance.ts:54-58; scripts/local-sqlite/schema.sql:357',
  consequence: 'tightening it here alone would make the module and the column disagree about '
    + 'what may be stored, which is how a write starts failing at one layer and not the other',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.00', date_as_of: '2026-13-45' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    kind: 'set',
    updates: { bank_balance: '900.00', bank_balance_date: '2026-13-45' },
    amount: '900.00',
    date_as_of: '2026-13-45',
  },
};
