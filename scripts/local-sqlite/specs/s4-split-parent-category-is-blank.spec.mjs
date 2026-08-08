export default {
  invariant: 'S-4',
  title: "a split parent's own category must be blank",
  design: 'DESIGN.md §1.2 S-4 ("D — transactions_split_parent_has_blank_category"); cloud RPC 20260713100000:225-227',
  consequence: 'the parent double-counts against a category its lines already claim — every report shows the money twice',
  parity: 'divergent',
  reason: 'the cloud has no such constraint: only set_transaction_splits blanks the parent, so any other writer can leave it categorised. The local file makes it structural.',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, is_split, category)
      VALUES ('70000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Split parent', -4000, 'expense', '2024-03-02', 1,
              'c0000000-0000-0000-0000-000000000003');`,
    expect: { outcome: 'refused', message: 'transactions_split_parent_has_blank_category' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, is_split, category)
      VALUES ('70000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Split parent', -40.00, 'expense', '2024-03-02', true,
              'c0000000-0000-0000-0000-000000000003');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'categorised_split_parents',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE is_split = 1 AND COALESCE(trim(category),'') <> ''`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE is_split AND COALESCE(btrim(category),'') <> ''`,
      expect: '1',
    },
  ],
};
