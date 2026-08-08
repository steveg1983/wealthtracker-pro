export default {
  invariant: 'C-2',
  title: 'a category level must be type, sub or detail',
  design: 'DESIGN.md §1.4 C-2 ("D"); cloud CHECK at initial-schema.sql:477-478',
  consequence: 'the tree stops having a shape the UI can render, and rollups silently skip the level they do not recognise',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO categories (id, user_id, name, type, level)
      VALUES ('c0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
              'Somewhere', 'expense', 'group');`,
    // Unnamed inline CHECKs report their expression, not a name — see README.
    expect: { outcome: 'refused', message: "CHECK constraint failed: level IN ('type','sub','detail')" },
  },

  postgres: {
    action: `
      INSERT INTO public.categories (id, user_id, name, type, level)
      VALUES ('c0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
              'Somewhere', 'expense', 'group');`,
    expect: { outcome: 'refused', message: 'categories_level_check' },
  },
};
