// The collision-guarded branch of the C-3 trigger. Categories are UNIQUE
// (user_id, name, parent_id); account names are not unique. Without the guard,
// creating a second account with an existing account's name would fail on a
// category constraint the user never sees and cannot act on.
export default {
  invariant: 'C-3 / C-6',
  title: 'a second account with the same name is still created; the category clash is absorbed',
  design: 'DESIGN.md §1.4 C-6 ("P" — the self-heal is collision-guarded); cloud ON CONFLICT (user_id, name, parent_id) DO NOTHING, 20260708140000:77',
  consequence: 'the user is told their new account could not be created, for a reason about a category they did not ask for',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
      VALUES ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
              'Everyday', 'savings', 0, 0);`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `
      INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance)
      VALUES ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
              'Everyday', 'savings', 0, 0);`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'accounts_named_everyday',
      sqlite: `SELECT COUNT(*) FROM accounts WHERE name = 'Everyday'`,
      postgres: `SELECT COUNT(*) FROM public.accounts WHERE name = 'Everyday'`,
      expect: '2',
    },
    {
      // One category, not two, and it still belongs to the first account. The
      // second account has none — v_integrity_violations reports that as
      // account_missing_transfer_category, which is the honest outcome: a
      // clash is a thing to fix, not a thing to invent a name for.
      name: 'categories_named_to_from_everyday',
      sqlite: `SELECT COUNT(*) FROM categories WHERE name = 'To/From Everyday'`,
      postgres: `SELECT COUNT(*) FROM public.categories WHERE name = 'To/From Everyday'`,
      expect: '1',
    },
    {
      name: 'category_owner_is_the_first_account',
      sqlite: `SELECT account_id FROM categories WHERE name = 'To/From Everyday'`,
      postgres: `SELECT account_id::text FROM public.categories WHERE name = 'To/From Everyday'`,
      expect: 'a0000000-0000-0000-0000-000000000001',
    },
  ],
};
