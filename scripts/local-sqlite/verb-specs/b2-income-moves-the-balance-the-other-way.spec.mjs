import {
  USER, EVERYDAY,
  balanceOf, balanceIdentityHolds, auditRowsForCreate,
} from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000a2';

// The sign convention is the row's, not the verb's: `balance = balance + amount`
// is the only statement either engine runs, and it does not read `type`.
// 20260310000500_fix_expense_amount_signs.sql is what made that safe.
export default {
  invariant: 'B-2',
  title: 'income moves the balance the other way, by the same one relative statement',
  design: 'DESIGN.md §1.1 B-2; the RPC has no branch on `type` at all',
  consequence: 'a verb that decided the direction itself would double-negate an expense the day a caller sent a positive amount with type=expense',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Invented payroll',
      amount: '1200.50',
      type: 'income',
      date: '2024-03-02',
    },
  },

  expect: { outcome: 'ok' },
  result: { amount: '1200.50', type: 'income', category: null },

  state: [
    // -25.00 + 1200.50 = 1175.50
    balanceOf(EVERYDAY, '1175.50'),
    balanceIdentityHolds(EVERYDAY),
    auditRowsForCreate(NEW_ROW, '1'),
  ],
};
