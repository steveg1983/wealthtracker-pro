export default {
  invariant: 'C-1',
  title: 'two root categories may share a name, because NULL parents are distinct',
  design: 'DESIGN.md §1.4 C-1 — "verified: SQLite treats NULLs as distinct in UNIQUE, same as Postgres"',
  consequence: 'if the engines disagreed here, restoring a cloud backup into a local file would either lose a root category or collide on one',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO categories (id, user_id, name, type, level)
      VALUES ('c0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
              'Transfer', 'income', 'type');`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `
      INSERT INTO public.categories (id, user_id, name, type, level)
      VALUES ('c0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
              'Transfer', 'income', 'type');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'roots_named_transfer',
      sqlite: `SELECT COUNT(*) FROM categories WHERE name = 'Transfer' AND parent_id IS NULL`,
      postgres: `SELECT COUNT(*) FROM public.categories WHERE name = 'Transfer' AND parent_id IS NULL`,
      expect: '2',
    },
  ],
};
