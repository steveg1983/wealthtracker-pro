export default {
  invariant: 'R-7',
  title: 'an account cannot be its own parent',
  design: 'DESIGN.md §1.8 R-7 ("D"); cloud CHECK accounts_parent_not_self, 20260722090000:33-35',
  consequence: 'any walk up the account tree never terminates',
  parity: 'match',

  sqlite: {
    action: `UPDATE accounts SET parent_account_id = id WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'accounts_parent_not_self' },
  },

  postgres: {
    action: `UPDATE public.accounts SET parent_account_id = id WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'refused', message: 'accounts_parent_not_self' },
  },
};
