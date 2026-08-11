import { EMPTY_LOGIN, emptyLogin, categoriesOwnedBy } from './_shared.mjs';

// The other of the RPC's two named refusals, and the one that says what a seed
// IS: the ids are the point. 'transfer-in' has to still be 'transfer-in' when
// the ledger asks for it, so a row that names none cannot be seeded under an id
// somebody invented for it — unlike a CREATE, which mints one on purpose.
export default {
  invariant: 'B-4',
  title: 'a seeded category with no id of its own is refused, and nothing lands',
  design: 'migrate_categories_atomic (20260724100000:74-77): `category_missing_id`, ERRCODE P0004',
  consequence: 'the app files transactions under these ids by name in its own source; a seed that minted one for a row would leave the code asking for a category the file has never heard of',
  parity: 'match',

  setup: emptyLogin,

  command: {
    verb: 'seed_categories',
    payload: {
      user_id: EMPTY_LOGIN,
      categories: [
        { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type' },
        { name: 'No id at all', type: 'expense', level: 'detail' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'category_missing_id' },

  state: [
    // Not one, which is what a writer that refused row by row would have left.
    categoriesOwnedBy(EMPTY_LOGIN, '0'),
  ],
};
