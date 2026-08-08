import { secondLogin } from './_setups.mjs';

// THE KEY BITES ON BOTH COLUMNS, not only on the account one.
//
// Every other r12 spec moves the ACCOUNT and keeps the owner. This one keeps
// the account and moves the OWNER — a row handed to a second login while it
// still sits in the first login's account. If the key were somehow only
// checking `account_id` (a single-column key wearing a composite name), every
// other r12 spec would still pass and this one would not.
//
// It is not a hypothetical shape. X-9 — ids are remapped on restore, because
// global primary keys collide across logins — describes a restore path that
// rewrites owners row by row, and `20260807083000_user_data_restore.sql` has to
// re-own every restored row to the caller (X-6). A re-owning pass that reaches
// `transactions` before `accounts` produces exactly this row, and the key is
// what makes it fail loudly at the moment it is written rather than quietly at
// the moment somebody reads a balance.
//
// MEASURED consequence of the alternative: nothing at all is raised. The row
// lands, the account it names belongs to the old owner, and the ledger of BOTH
// logins is now wrong — the old one because a row moved out of it without its
// balance moving, the new one because it has a row in an account it does not
// own.
export default {
  invariant: 'R-12',
  title: 'a transaction may not be handed to another login while it sits in this one\'s account',
  design: 'transactions_account_id_user_fkey is a key on TWO columns — cloud 20260808170000:439-443, local schema.sql transactions table foot',
  consequence: 'a re-owning pass that runs before the accounts it depends on silently splits one ledger across two logins, with no error at the moment it happens',
  parity: 'match',

  sqlite: {
    setup: secondLogin.sqlite,
    action: `
      UPDATE transactions SET user_id = '22222222-2222-2222-2222-222222222222'
       WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: secondLogin.postgres,
    action: `
      UPDATE public.transactions SET user_id = '22222222-2222-2222-2222-222222222222'
       WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'transactions_account_id_user_fkey' },
  },

  verify: [
    {
      name: 'the_row_kept_the_owner_it_had',
      sqlite: `SELECT user_id FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT user_id::text FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: '11111111-1111-1111-1111-111111111111',
    },
    {
      // The second login gained nothing, which is the half a reader checks
      // first: a refused re-owning must not have moved the row half-way.
      name: 'the_second_login_has_no_transactions',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE user_id = '22222222-2222-2222-2222-222222222222'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE user_id = '22222222-2222-2222-2222-222222222222'`,
      expect: '0',
    },
  ],
};
