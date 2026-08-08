export default {
  invariant: 'R-2 / R-3',
  title: 'deleting a category nulls category_id and leaves category holding a dead id',
  design: 'DESIGN.md §1.8 R-2 ("D") and R-3 ("Deliberately kept as TEXT … a pre-existing gap I am carrying forward, visibly")',
  consequence: 'the app resolves categories by the TEXT column, not the FK one, so the FK protects the column nobody reads. Both engines have the gap; the local file at least reports it as dangling_category_ref',
  parity: 'match',

  sqlite: {
    setup: `UPDATE transactions SET category_id = 'c0000000-0000-0000-0000-000000000003'
             WHERE id = '70000000-0000-0000-0000-000000000001';`,
    action: `DELETE FROM categories WHERE id = 'c0000000-0000-0000-0000-000000000003';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `UPDATE public.transactions SET category_id = 'c0000000-0000-0000-0000-000000000003'
             WHERE id = '70000000-0000-0000-0000-000000000001';`,
    action: `DELETE FROM public.categories WHERE id = 'c0000000-0000-0000-0000-000000000003';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'category_id_nulled',
      sqlite: `SELECT COALESCE(category_id, 'NULLED') FROM transactions
                WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT COALESCE(category_id::text, 'NULLED') FROM public.transactions
                  WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: 'NULLED',
    },
    {
      name: 'category_text_left_dangling',
      sqlite: `SELECT category FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT category FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: 'c0000000-0000-0000-0000-000000000003',
    },
  ],
};
