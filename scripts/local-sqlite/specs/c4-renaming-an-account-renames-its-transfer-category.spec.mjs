// The second half of the same finding as c3, and now the same match:
// sync_transfer_category_for_account was missing from schema.sql and has been
// ported into both copies.
export default {
  invariant: 'C-4',
  title: 'renaming an account renames its To/From category',
  design: 'DESIGN.md §1.4 C-4 ("T"); cloud trigger sync_transfer_category_for_account, 20260708140000:90-119',
  consequence: 'every dropdown keeps offering the old account name, and the user cannot tell which of two similar names is live',
  parity: 'match',

  sqlite: {
    action: `UPDATE accounts SET name = 'Everyday (joint)' WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `UPDATE public.accounts SET name = 'Everyday (joint)' WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'transfer_category_name',
      sqlite: `SELECT name FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category = 1`,
      postgres: `SELECT name FROM public.categories
                  WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category`,
      expect: 'To/From Everyday (joint)',
    },
    {
      // The rename must not multiply the category, and must not touch the
      // other account's.
      name: 'other_accounts_category_untouched',
      sqlite: `SELECT name FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category = 1`,
      postgres: `SELECT name FROM public.categories
                  WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category`,
      expect: 'To/From Rainy day',
    },
  ],
};
