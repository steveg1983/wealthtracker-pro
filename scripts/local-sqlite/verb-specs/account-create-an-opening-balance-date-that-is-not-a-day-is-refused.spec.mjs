import { USER, NEW_ACCOUNT, accountsOwned } from './_shared.mjs';

export default {
  invariant: 'D-8',
  title: 'a 31st of February is refused by both engines, by different names',
  design: 'wire::is_calendar_date, the same local strengthening create_transaction applies to `date`; schema.sql’s CHECK is only a shape test (LIKE \'____-__-__\') and would let this through',
  consequence: 'a ledger that accepts 31 February is not a smaller problem than one that accepts a float — the day an opening balance is true for is what every reconciliation counts from',
  parity: 'match',

  command: {
    verb: 'create_account',
    payload: {
      id: NEW_ACCOUNT,
      user_id: USER,
      name: 'Rainy day',
      opening_balance_date: '2024-02-31',
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'date_invalid' },
    postgres: { outcome: 'refused', error: 'date/time field value out of range' },
  },

  state: [accountsOwned('2')],
};
