import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// I-3, reached through the RPC rather than through a raw insert. The table's own
// CHECK (transactions_import_provenance_complete) says the same thing; the
// function says it first, by name, and with a count.
export default {
  invariant: 'I-3',
  title: 'a row stating one provenance column without the other is refused by name',
  design: 'import_transactions_atomic 20260808140000:287-290; the table constraint transactions_import_provenance_complete says it less legibly',
  consequence: 'a source with no id cannot be deduped and an id with no source cannot be attributed — the row is unfindable either way',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01', import_source: 'ofx' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'import_provenance_incomplete' },

  state: [
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditTrail('NONE'),
  ],
};
