export default {
  invariant: 'C-11',
  title: 'a category cannot be two kinds of special at once',
  design: 'DESIGN.md §1.4 C-11 ("D (shape) + P (semantics)"); new constraint categories_flags_exclusive',
  consequence: 'is_unassigned_bucket DEclassifies while the other two CLASSIFY — a row carrying both has no defined meaning in utils/incomeExpense.ts, and the figure lands wherever the first branch happens to be',
  parity: 'divergent',
  reason: 'the cloud has three independent booleans and no constraint between them. The local file makes them mutually exclusive.',

  sqlite: {
    action: `
      INSERT INTO categories (id, user_id, name, type, level, is_transfer_category, is_revaluation_category)
      VALUES ('c0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111',
              'Confused', 'both', 'detail', 1, 1);`,
    expect: { outcome: 'refused', message: 'categories_flags_exclusive' },
  },

  postgres: {
    action: `
      INSERT INTO public.categories (id, user_id, name, type, level, is_transfer_category, is_revaluation_category)
      VALUES ('c0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111',
              'Confused', 'both', 'detail', true, true);`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'categories_with_two_flags',
      sqlite: `SELECT COUNT(*) FROM categories
                WHERE is_transfer_category + is_revaluation_category + is_unassigned_bucket > 1`,
      postgres: `SELECT COUNT(*) FROM public.categories
                  WHERE is_transfer_category::int + is_revaluation_category::int + is_unassigned_bucket::int > 1`,
      expect: '1',
    },
  ],
};
