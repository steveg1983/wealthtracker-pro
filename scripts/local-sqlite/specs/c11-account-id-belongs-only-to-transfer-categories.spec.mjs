export default {
  invariant: 'C-11',
  title: 'only a To/From category may belong to an account',
  design: 'schema.sql categories_account_only_for_transfer — marked NEW there; the cloud has no such constraint',
  consequence: 'an ordinary category acquires an account_id, and deleting that account cascades away a category that had nothing to do with it',
  parity: 'divergent',
  reason: 'the cloud lets any category carry an account_id; only convention keeps that column for To/From rows. The local file makes the convention a constraint.',

  sqlite: {
    action: `
      INSERT INTO categories (id, user_id, name, type, level, parent_id, account_id)
      VALUES ('c0000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111',
              'Fuel', 'expense', 'sub', 'c0000000-0000-0000-0000-000000000002',
              'a0000000-0000-0000-0000-000000000001');`,
    expect: { outcome: 'refused', message: 'categories_account_only_for_transfer' },
  },

  postgres: {
    action: `
      INSERT INTO public.categories (id, user_id, name, type, level, parent_id, account_id)
      VALUES ('c0000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111',
              'Fuel', 'expense', 'sub', 'c0000000-0000-0000-0000-000000000002',
              'a0000000-0000-0000-0000-000000000001');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'non_transfer_categories_owning_an_account',
      sqlite: `SELECT COUNT(*) FROM categories WHERE account_id IS NOT NULL AND is_transfer_category = 0`,
      postgres: `SELECT COUNT(*) FROM public.categories WHERE account_id IS NOT NULL AND NOT is_transfer_category`,
      expect: '1',
    },
  ],
};
