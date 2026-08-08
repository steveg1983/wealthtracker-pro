import { USER, EVERYDAY } from './_shared.mjs';

export default {
  invariant: 'MONEY-1',
  title: 'the bank\'s figure may not arrive as a JSON number',
  design: 'crate::money — a JSON number is an IEEE-754 double by the time any parser has read it, so Money refuses one at the boundary. The cloud casts (p->>\'bank_balance\')::numeric, and ->> renders a JSON number as its own spelling, so it accepts either',
  consequence: 'this figure is assigned to a balance ABSOLUTELY and shifts the opening balance by the same delta; a value that has been through a binary float on the way in would rebase the account to a number nobody sent',
  parity: 'divergent',
  reason: 'A DECLARED local strengthening, the same one crate::money makes everywhere else: the cloud accepts a JSON number because Postgres\'s ->> hands it to a numeric cast as text, and the local edition refuses it because there is no honest way to tell a double that has already lost a digit from one that has not. Both engines agree on the string form, which is what every caller in the product sends.',

  command: {
    verb: 'link_bank_account_snap',
    payload: { account_id: EVERYDAY, user_id: USER, bank_balance: 10.0 },
  },
  expect: {
    sqlite: { outcome: 'refused', error: 'amount_must_be_a_string' },
    postgres: { outcome: 'ok' },
  },
  state: [
    {
      name: 'the_balance_afterwards',
      sqlite: `SELECT ('-' || CAST(abs(balance_minor) / 100 AS TEXT) || '.'
                 || substr('0' || CAST(abs(balance_minor) % 100 AS TEXT), -2, 2))
                 FROM accounts WHERE id = '${EVERYDAY}'`,
      postgres: `SELECT balance::text FROM public.accounts WHERE id = '${EVERYDAY}'`,
      expect: { sqlite: '-25.00', postgres: '10.00' },
    },
  ],
};
