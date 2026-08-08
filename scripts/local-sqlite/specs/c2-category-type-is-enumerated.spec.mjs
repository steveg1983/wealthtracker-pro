export default {
  invariant: 'C-2',
  title: 'a category type must be income, expense or both',
  design: 'DESIGN.md §1.4 C-2 ("D"); cloud CHECK at initial-schema.sql:477-478',
  consequence: 'utils/incomeExpense.ts decides which side of every report a figure lands on from this column; an unknown value has no side',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO categories (id, user_id, name, type, level)
      VALUES ('c0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
              'Neither', 'transfer', 'type');`,
    expect: { outcome: 'refused', message: "CHECK constraint failed: type IN ('income','expense','both')" },
  },

  postgres: {
    action: `
      INSERT INTO public.categories (id, user_id, name, type, level)
      VALUES ('c0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
              'Neither', 'transfer', 'type');`,
    expect: { outcome: 'refused', message: 'categories_type_check' },
  },
};
