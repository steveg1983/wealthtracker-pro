import { secondLogin } from './_setups.mjs';

// R-12 on `categories.account_id` — the account-scoped categories, which in
// practice means the per-account To/From category the account trigger mints
// (initial-schema.sql:1744-1748; C-3).
//
// Not money, and included anyway for the reason the migration gives: "a
// category filed against a stranger's account is a category nothing can ever
// clean up through the UI" (20260808170000:110-116). C-5 refuses to let a
// To/From category be deleted while its account exists, and that account is one
// this login cannot see — so the row would be undeletable by the only person
// who can see IT.
//
// The action re-points an EXISTING To/From category rather than inserting a new
// one, because `categories_account_only_for_transfer` (local) means only a
// transfer category may carry an account_id at all, and the transfer categories
// are minted by a trigger with ids nobody can name at authoring time. Reaching
// it through the account is the house rule for both engines.
export default {
  invariant: 'R-12',
  title: 'a category may not be scoped to an account belonging to another login',
  design: 'categories_account_id_user_fkey — cloud 20260808170000:496-503, local schema.sql categories table foot',
  consequence: 'C-5 makes a To/From category undeletable while its account lives, so the row becomes permanent junk in the only ledger that can see it',
  parity: 'match',

  sqlite: {
    setup: secondLogin.sqlite,
    action: `
      UPDATE categories SET account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category = 1;`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: secondLogin.postgres,
    action: `
      UPDATE public.categories SET account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category;`,
    expect: { outcome: 'refused', message: 'categories_account_id_user_fkey' },
  },

  verify: [
    {
      // The control: the category is scoped to an account of the caller's own
      // and stayed there. C-3's trigger put it there, so the column works.
      name: 'the_transfer_category_kept_its_own_account',
      sqlite: `SELECT COUNT(*) FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category = 1`,
      postgres: `SELECT COUNT(*) FROM public.categories
                  WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category`,
      expect: '1',
    },
    {
      name: 'no_category_is_scoped_to_another_logins_account',
      sqlite: `SELECT COUNT(*) FROM categories x JOIN accounts a ON a.id = x.account_id
                WHERE a.user_id <> x.user_id`,
      postgres: `SELECT COUNT(*) FROM public.categories x JOIN public.accounts a ON a.id = x.account_id
                  WHERE a.user_id <> x.user_id`,
      expect: '0',
    },
  ],
};
