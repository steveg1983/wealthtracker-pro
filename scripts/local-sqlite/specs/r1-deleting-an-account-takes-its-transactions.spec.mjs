export default {
  invariant: 'R-1',
  title: 'deleting an account deletes its transactions and its To/From category',
  design: 'DESIGN.md §1.8 R-1 ("D"); cloud initial-schema.sql:1932. The category half is X-3: the wipe deletes accounts FIRST so C-5\'s protection is already satisfied (20260807083000:140-146)',
  consequence: 'transactions with no account are invisible everywhere and countable nowhere; a surviving To/From category outlives the thing it names',
  parity: 'match',

  sqlite: {
    action: `DELETE FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `DELETE FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'transactions_left_behind',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE account_id = 'a0000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE account_id = 'a0000000-0000-0000-0000-000000000001'`,
      expect: '0',
    },
    {
      name: 'transfer_categories_left_behind',
      sqlite: `SELECT COUNT(*) FROM categories WHERE account_id = 'a0000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COUNT(*) FROM public.categories WHERE account_id = 'a0000000-0000-0000-0000-000000000001'`,
      expect: '0',
    },
  ],
};
