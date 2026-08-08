// A DECLARED DIVERGENCE — the same one, at the second of three sites.
// `toNumber(toDecimal(x))` is `toDecimalPlaces(2)` under a ROUND_HALF_UP
// configuration, so 900.005 becomes 900.01 and the file's own figure is not
// what reconciliation ends up comparing against. The port refuses instead.
export default {
  invariant: 'MONEY-1',
  title: 'a closing balance quoted to three places: rounded by the module, refused by the port',
  design: 'src/utils/statementBankBalance.ts:149-151; crates/wealth-core/src/money.rs',
  consequence: 'the figure a person reconciles against is a penny away from the one their '
    + 'statement prints, and nothing anywhere says so',
  parity: 'divergent',
  reason: 'toDecimalPlaces(2) rounds half away from zero; Money::parse refuses rather than '
    + 'rounding money on the caller\'s behalf',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '900.005', date_as_of: '2026-03-31' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: {
    typescript: { outcome: 'ok' },
    rust: { outcome: 'refused', error: 'amount_not_representable' },
  },
  result: {
    kind: 'set',
    updates: { bank_balance: '900.01', bank_balance_date: '2026-03-31' },
    amount: '900.01',
    date_as_of: '2026-03-31',
  },
};
