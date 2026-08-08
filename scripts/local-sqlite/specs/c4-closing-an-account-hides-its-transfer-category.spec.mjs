export default {
  invariant: 'C-4',
  title: 'closing an account hides its To/From category',
  design: 'DESIGN.md §1.4 C-4 ("T"); cloud sync_transfer_category_for_account, 20260708140000:90-119 — "closed account → hidden category"',
  consequence: "a closed account keeps offering itself in every transfer dropdown, so money gets filed into an account the user believes is shut",
  parity: 'match',

  sqlite: {
    action: `UPDATE accounts SET is_active = 0 WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `UPDATE public.accounts SET is_active = false WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'transfer_category_is_active',
      sqlite: `SELECT is_active FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category = 1`,
      postgres: `SELECT is_active::int FROM public.categories
                  WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category`,
      expect: '0',
    },
    {
      // Closing an account must not rename its category, and must not touch
      // the other account's.
      name: 'transfer_category_name_unchanged',
      sqlite: `SELECT name FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category = 1`,
      postgres: `SELECT name FROM public.categories
                  WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category`,
      expect: 'To/From Everyday',
    },
  ],
};
