// TS-I2, and a rule about NOT applying another rule — the easiest kind to lose.
// OFX signs a statement's balance in the same frame as the transactions printed
// beside it, so a card with money owing closes NEGATIVE, which is how this app
// stores a liability. TrueLayer's card API is the opposite and cardNormalization
// negates it there; doing that here would turn a debt into an asset.
export default {
  invariant: 'TS-I2',
  title: 'a card statement that closes negative is stored negative',
  design: 'src/utils/statementBankBalance.ts:23-31; src/services/banking/cardNormalization.ts',
  consequence: 'the app would report money owed as money held, at the top of the net-worth figure',
  parity: 'match',

  command: {
    verb: 'plan_statement_bank_balance',
    payload: {
      statement: { amount: '-1234.56', date_as_of: '2026-03-31' },
      account: { bank_balance: null, bank_balance_date: null },
      destination_confirmed: true,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    kind: 'set',
    updates: { bank_balance: '-1234.56', bank_balance_date: '2026-03-31' },
    amount: '-1234.56',
    date_as_of: '2026-03-31',
  },
};
