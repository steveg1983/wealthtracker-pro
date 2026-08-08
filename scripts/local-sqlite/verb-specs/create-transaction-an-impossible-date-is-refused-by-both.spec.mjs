import {
  USER, EVERYDAY, OPENING_BALANCE,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsInTotal,
} from './_shared.mjs';

// Both engines refuse; they word it differently, and the difference is the port.
//
// Postgres gets this free: `(p->>'date')::date` rejects 29 February 2023 as a
// cast failure. `schema.sql`'s CHECK is only a SHAPE test
// (`date LIKE '____-__-__'`), so the local file on its own would accept it —
// which is why the verb validates the calendar before it opens a transaction.
//
// This is a local strengthening with a different name, declared rather than
// smoothed over: outcome parity holds, prose parity does not, and the spec says
// which refusal each engine must produce.
export default {
  invariant: 'TS-I3',
  title: 'a date that is not a real day is refused before anything is written',
  design: '(p->>\'date\')::date at 20260808100000:143; schema.sql transactions.date CHECK is a shape test only',
  consequence: 'a ledger that accepts 29 February 2023 will sort it, report it and reconcile against it, and no screen will ever say why the month does not add up',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: '70000000-0000-0000-0000-0000000000b6',
      user_id: USER,
      account_id: EVERYDAY,
      description: 'A day that did not happen',
      amount: '-1.00',
      type: 'expense',
      date: '2023-02-29',
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'date_invalid' },
    postgres: { outcome: 'refused', error: 'date/time field value out of range' },
  },

  state: [
    balanceOf(EVERYDAY, OPENING_BALANCE),
    balanceIdentityHolds(EVERYDAY),
    rowsInAccount(EVERYDAY, '1'),
    auditRowsInTotal('0'),
  ],
};
