export default {
  invariant: 'C-12',
  title: 'deleting a category takes its children with it',
  design: 'DESIGN.md §1.8 C-12 ("D, with the FK pragma"); cloud initial-schema.sql:1748',
  consequence: 'orphaned children float at the top of the tree with a parent id that resolves to nothing',
  parity: 'match',

  sqlite: {
    action: `DELETE FROM categories WHERE id = 'c0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `DELETE FROM public.categories WHERE id = 'c0000000-0000-0000-0000-000000000002';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'child_category_gone',
      sqlite: `SELECT COUNT(*) FROM categories WHERE id = 'c0000000-0000-0000-0000-000000000003'`,
      postgres: `SELECT COUNT(*) FROM public.categories WHERE id = 'c0000000-0000-0000-0000-000000000003'`,
      expect: '0',
    },
    {
      // R-3, visible: the transaction still holds the deleted child's id as
      // TEXT, in BOTH engines. This is the gap DESIGN.md carries forward
      // deliberately rather than fixing silently.
      name: 'transaction_still_holds_the_deleted_category_id',
      sqlite: `SELECT category FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT category FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: 'c0000000-0000-0000-0000-000000000003',
    },
  ],
};
