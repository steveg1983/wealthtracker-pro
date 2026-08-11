import { USER, balanceIdentityHolds, categoriesOwnedBy, categoryPresent } from './_shared.mjs';

const FIRST = 'c0000000-0000-0000-0000-0000000000f1';
const SECOND = 'c0000000-0000-0000-0000-0000000000f2';

// One statement in the cloud, one transaction locally: either way a row the
// table will not have loses the rows beside it. The caller re-reads the whole
// set afterwards, so a half-written tree would be a tree the user then has to
// find the gaps in.
export default {
  invariant: 'B-9',
  title: 'a bulk create is all or nothing',
  design: 'planningService.createCategories sends ONE `.insert(rows)`; Postgres rolls the statement back entire, and the verb wraps its loop in one SQLite transaction',
  consequence: 'half an imported tree is worse than none: the import reports success, the missing groups look like categories the user never had, and the second run collides with the half that landed',
  parity: 'match',

  command: {
    verb: 'create_categories',
    payload: {
      user_id: USER,
      categories: [
        { id: FIRST, name: 'Fuel', type: 'expense', level: 'detail' },
        // `level` is CHECKed on both engines.
        { id: SECOND, name: 'Parking', type: 'expense', level: 'nonsense' },
      ],
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'CHECK constraint failed' },
    postgres: { outcome: 'refused', error: 'categories_level_check' },
  },

  state: [
    categoryPresent(FIRST, 'GONE'),
    categoriesOwnedBy(USER, '5'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
