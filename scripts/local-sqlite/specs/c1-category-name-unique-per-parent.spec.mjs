export default {
  invariant: 'C-1',
  title: 'two categories cannot share a name under the same parent',
  design: 'DESIGN.md §1.4 C-1 ("D"); cloud UNIQUE (user_id, name, parent_id), initial-schema.sql:938',
  consequence: 'the category picker shows the same name twice and money splits between them at random',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO categories (id, user_id, name, type, level, parent_id)
      VALUES ('c0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
              'Weekly shop', 'expense', 'sub', 'c0000000-0000-0000-0000-000000000002');`,
    expect: {
      outcome: 'refused',
      message: 'UNIQUE constraint failed: categories.user_id, categories.name, categories.parent_id',
    },
  },

  postgres: {
    action: `
      INSERT INTO public.categories (id, user_id, name, type, level, parent_id)
      VALUES ('c0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
              'Weekly shop', 'expense', 'sub', 'c0000000-0000-0000-0000-000000000002');`,
    // The engines name the same rule differently: SQLite quotes the columns,
    // Postgres names the constraint. Same rule, and both refuse.
    expect: { outcome: 'refused', message: 'categories_user_id_name_parent_id_key' },
  },
};
