import { secondLogin } from './_setups.mjs';

// R-12 on `accounts.parent_account_id` — the investment/(Cash) pairing
// (20260722090000:22-24), and the only self-referential one of the seven.
//
// "An account may only be paired with an account of the same owner" is what the
// feature always meant and was never a rule (20260808170000:105-109). Nothing
// in the cloud or the local file said so before the composite key; a nested
// pair across two logins would have put a stranger's cash account inside this
// login's investment account, where the UI would render it and no query would
// ever explain it.
//
// The setup nests Rainy day under Everyday — the caller's own two accounts, the
// exact shape specs/r6-deleting-a-parent-account-unnests-the-child relies on —
// so the legality of nesting is established before the action tries to nest
// across logins.
export default {
  invariant: 'R-12',
  title: 'an account may not be nested under an account belonging to another login',
  design: 'accounts_parent_account_id_user_fkey — cloud 20260808170000:483-490, local schema.sql accounts table foot',
  consequence: 'a stranger\'s cash account renders inside this login\'s investment account, and the portfolio total includes money nobody here owns',
  parity: 'match',

  sqlite: {
    setup: `
      ${secondLogin.sqlite}
      UPDATE accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000001'
       WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    action: `
      UPDATE accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'refused', message: 'FOREIGN KEY constraint failed' },
  },

  postgres: {
    setup: `
      ${secondLogin.postgres}
      UPDATE public.accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000001'
       WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    action: `
      UPDATE public.accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000009'
       WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'refused', message: 'accounts_parent_account_id_user_fkey' },
  },

  verify: [
    {
      // The control, read back: nesting under an account of your own stands.
      name: 'the_nesting_of_your_own_survives',
      sqlite: `SELECT COALESCE(parent_account_id, 'UNNESTED') FROM accounts
                WHERE id = 'a0000000-0000-0000-0000-000000000002'`,
      postgres: `SELECT COALESCE(parent_account_id::text, 'UNNESTED') FROM public.accounts
                  WHERE id = 'a0000000-0000-0000-0000-000000000002'`,
      expect: 'a0000000-0000-0000-0000-000000000001',
    },
    {
      name: 'no_account_is_nested_under_another_logins_account',
      sqlite: `SELECT COUNT(*) FROM accounts c JOIN accounts p ON p.id = c.parent_account_id
                WHERE p.user_id <> c.user_id`,
      postgres: `SELECT COUNT(*) FROM public.accounts c JOIN public.accounts p ON p.id = c.parent_account_id
                  WHERE p.user_id <> c.user_id`,
      expect: '0',
    },
  ],
};
