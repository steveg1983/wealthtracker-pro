import { USER, OUTGOINGS, balanceIdentityHolds, categoriesOwnedBy } from './_shared.mjs';

const NEW = 'c0000000-0000-0000-0000-0000000000f1';

// ux_categories_user_name_parent, in both engines since initial-schema.sql:938.
// The tree import relies on it: two 'Fuel' leaves under one group would make the
// picker offer the same name twice with two ids, and half the history would be
// filed under each.
export default {
  invariant: 'B-5',
  title: 'two categories of the same name under the same parent are refused by the file',
  design: 'initial-schema.sql:938 ux_categories_user_name_parent — (user_id, name, parent_id), and NULLs are distinct in a unique index on BOTH engines',
  consequence: 'a duplicated name under one group is two ids for one thing: the register shows the same category twice and every report splits its total between them',
  parity: 'match',

  setup: {
    sqlite: `INSERT INTO categories (id, user_id, name, type, level, parent_id)
               VALUES ('c0000000-0000-0000-0000-0000000000f0', '${USER}', 'Fuel', 'expense', 'detail', '${OUTGOINGS}');`,
    postgres: `INSERT INTO public.categories (id, user_id, name, type, level, parent_id)
                 VALUES ('c0000000-0000-0000-0000-0000000000f0', '${USER}', 'Fuel', 'expense', 'detail', '${OUTGOINGS}');`,
  },

  command: {
    verb: 'create_category',
    payload: {
      id: NEW,
      user_id: USER,
      name: 'Fuel',
      type: 'expense',
      level: 'detail',
      parent_id: OUTGOINGS,
    },
  },

  // ONE index, two ways of naming it in a message. Postgres prints the index
  // (`categories_user_id_name_parent_id_key`, which it generated from the column
  // list); SQLite prints the COLUMNS. Same three columns, same rule, same
  // refusal — and each is stated per engine rather than softened to "it errored",
  // because a spec that only asked whether something failed would pass for a typo
  // in its own fixture.
  expect: {
    sqlite: {
      outcome: 'refused',
      error: 'UNIQUE constraint failed: categories.user_id, categories.name, categories.parent_id',
    },
    postgres: { outcome: 'refused', error: 'categories_user_id_name_parent_id_key' },
  },

  state: [
    categoriesOwnedBy(USER, '6'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
