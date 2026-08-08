export default {
  invariant: 'R-6',
  title: 'deleting an investment account un-nests its cash account rather than blocking',
  design: 'DESIGN.md §1.8 R-6 ("D"); cloud 20260722090000:24-25',
  consequence: 'the alternative is worse both ways: RESTRICT blocks the delete forever, CASCADE takes the cash account and its whole history with it',
  parity: 'match',

  sqlite: {
    setup: `UPDATE accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000001'
             WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    action: `DELETE FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `UPDATE public.accounts SET parent_account_id = 'a0000000-0000-0000-0000-000000000001'
             WHERE id = 'a0000000-0000-0000-0000-000000000002';`,
    action: `DELETE FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'child_account_survives',
      sqlite: `SELECT COUNT(*) FROM accounts WHERE id = 'a0000000-0000-0000-0000-000000000002'`,
      postgres: `SELECT COUNT(*) FROM public.accounts WHERE id = 'a0000000-0000-0000-0000-000000000002'`,
      expect: '1',
    },
    {
      name: 'child_account_unnested',
      sqlite: `SELECT COALESCE(parent_account_id, 'UNNESTED') FROM accounts
                WHERE id = 'a0000000-0000-0000-0000-000000000002'`,
      postgres: `SELECT COALESCE(parent_account_id::text, 'UNNESTED') FROM public.accounts
                  WHERE id = 'a0000000-0000-0000-0000-000000000002'`,
      expect: 'UNNESTED',
    },
  ],
};
