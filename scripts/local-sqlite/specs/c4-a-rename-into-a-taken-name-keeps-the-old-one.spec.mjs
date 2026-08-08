// The collision-guarded branch of the C-4 trigger, and the reason it exists:
// "an account rename or bank sync must never abort on a category naming clash"
// (20260708140000:86-89). is_active still syncs; only the name is held back.
export default {
  invariant: 'C-4 / C-6',
  title: 'renaming an account into a name another category already owns keeps the old category name',
  design: 'DESIGN.md §1.4 C-6 ("P"); cloud sync_transfer_category_for_account collision CASE, 20260708140000:97-106',
  consequence: 'the rename — or the bank sync doing the renaming — fails outright, on a category constraint the user cannot see from the account screen',
  parity: 'match',

  // The account is renamed AND closed in one statement, deliberately. "The
  // category kept its old name" is trivially true if the sync trigger does not
  // run at all — the first draft of this spec passed with the trigger deleted.
  // Closing at the same time forces the spec to prove the guard held back only
  // the NAME while the rest of the sync went through.
  sqlite: {
    action: `UPDATE accounts SET name = 'Rainy day', is_active = 0
              WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `UPDATE public.accounts SET name = 'Rainy day', is_active = false
              WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'account_was_renamed',
      sqlite: `SELECT name FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT name FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000001'`,
      expect: 'Rainy day',
    },
    {
      name: 'category_kept_its_old_name',
      sqlite: `SELECT name FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category = 1`,
      postgres: `SELECT name FROM public.categories
                  WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category`,
      expect: 'To/From Everyday',
    },
    {
      // The half of the sync that is NOT held back by the clash. This is the
      // assertion that makes the spec discriminating.
      name: 'is_active_synced_anyway',
      sqlite: `SELECT is_active FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category = 1`,
      postgres: `SELECT is_active::int FROM public.categories
                  WHERE account_id = 'a0000000-0000-0000-0000-000000000001' AND is_transfer_category`,
      expect: '0',
    },
    {
      name: 'the_name_it_wanted_is_still_the_other_accounts',
      sqlite: `SELECT account_id FROM categories WHERE name = 'To/From Rainy day'`,
      postgres: `SELECT account_id::text FROM public.categories WHERE name = 'To/From Rainy day'`,
      expect: 'a0000000-0000-0000-0000-000000000002',
    },
  ],
};
