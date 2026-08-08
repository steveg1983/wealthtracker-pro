import {
  USER, EVERYDAY, WEEKLY_SHOP,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsForCreate,
} from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000a1';

// The happy path, and the one that matters most. Everything else in this
// directory is a variation on it.
export default {
  invariant: 'B-2',
  title: 'an expense inserts a row and moves its account by exactly that amount',
  design: 'DESIGN.md §1.1 B-2; live RPC supabase/migrations/20260808100000_category_provenance.sql:161-166',
  consequence: 'if the balance does not move with the row, every displayed figure is a fiction — B-1 is broken on the first write',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Corner shop',
      // A decimal STRING. Never a JSON number: a JSON number is a double.
      amount: '-12.34',
      type: 'expense',
      date: '2024-03-02',
      category: WEEKLY_SHOP,
    },
  },

  expect: { outcome: 'ok' },

  result: {
    amount: '-12.34',
    type: 'expense',
    date: '2024-03-02',
    category: WEEKLY_SHOP,
    is_cleared: false,
    is_split: false,
    archived: false,
    statement_sequence: null,
    category_confirmed: true,
    linked_transfer_id: null,
  },

  state: [
    // -25.00 opening + -12.34 = -37.34, in SQL, relative, on both engines.
    balanceOf(EVERYDAY, '-37.34'),
    balanceIdentityHolds(EVERYDAY),
    rowsInAccount(EVERYDAY, '2'),
    auditRowsForCreate(NEW_ROW, '1'),
  ],
};
