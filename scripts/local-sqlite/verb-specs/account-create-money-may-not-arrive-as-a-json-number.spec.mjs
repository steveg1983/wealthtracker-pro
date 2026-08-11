import { USER, NEW_ACCOUNT, accountsOwned } from './_shared.mjs';

// M-1 at the account boundary. The cloud's numeric cast reads a JSON number
// happily — by which point a parser has already made it a double.
export default {
  invariant: 'MONEY-1',
  title: 'an opening balance sent as a JSON number is refused rather than parsed as a double',
  design: 'crates/wealth-core/src/money.rs — Money refuses a JSON number at the deserialiser, before a connection is touched',
  consequence: 'a JSON number IS an IEEE-754 double by the time any parser has read it; 250.5 survives and 0.1 + 0.2 does not, and the difference only shows up in somebody’s balance',
  parity: 'divergent',
  reason: 'Postgres accepts a JSON number into numeric because ->> hands it the text of whatever was parsed; the local boundary refuses the shape outright, which is TS-M1 in the local edition’s favour and cannot be reproduced there',

  command: {
    verb: 'create_account',
    payload: { id: NEW_ACCOUNT, user_id: USER, name: 'Rainy day', initial_balance: 250.5 },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'amount_must_be_a_string' },
    postgres: { outcome: 'ok' },
  },

  state: [accountsOwned({ sqlite: '2', postgres: '3' })],
};
