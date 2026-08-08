// THE CONTROL for C-5's third condition, and the reason that condition exists.
//
// C-5 protects a To/From category while its account is there. A two-condition
// version of that test (transfer category + account exists) also blocks the one
// delete that must never be blocked: erasing the user. The cascade reaches the
// category while the account row is still present, the trigger raises, and the
// whole erasure aborts with every row still in place. Measured on this schema
// before the third clause was added:
//
//   two-condition   -> DELETE FROM users REFUSED: transfer_category_protected
//                      rows left: users 1, accounts 1, categories 2
//   three-condition -> SUCCEEDED, 0 rows left      (Postgres: same)
//
// If this spec ever fails, the users-row clause has been dropped again and
// "delete everything" has quietly become impossible.
export default {
  invariant: 'C-5',
  title: 'erasing the user deletes everything, protection included',
  design: 'DESIGN.md §1.4 C-5; cloud protect_transfer_category, 20260708140000:127-146 — three conditions, and :24-27 explains why',
  consequence: 'the account-deletion and wipe paths stall half-done on transfer_category_protected, and a user who asked to be forgotten is not',
  parity: 'match',

  sqlite: {
    action: `DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `DELETE FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'rows_left_behind',
      sqlite: `SELECT (SELECT COUNT(*) FROM users) || '/' || (SELECT COUNT(*) FROM accounts)
                 || '/' || (SELECT COUNT(*) FROM categories) || '/' || (SELECT COUNT(*) FROM transactions)`,
      postgres: `SELECT (SELECT COUNT(*) FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111')
                   || '/' || (SELECT COUNT(*) FROM public.accounts WHERE user_id = '11111111-1111-1111-1111-111111111111')
                   || '/' || (SELECT COUNT(*) FROM public.categories WHERE user_id = '11111111-1111-1111-1111-111111111111')
                   || '/' || (SELECT COUNT(*) FROM public.transactions WHERE user_id = '11111111-1111-1111-1111-111111111111')`,
      expect: '0/0/0/0',
    },
  ],
};
