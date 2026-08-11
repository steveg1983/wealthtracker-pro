import { USER, balanceIdentityHolds, categoriesOwnedBy, parentOf } from './_shared.mjs';

const GROUP = 'c0000000-0000-0000-0000-0000000000f1';
const LEAF = 'c0000000-0000-0000-0000-0000000000f2';

// The tree import's own shape: a plan computed level by level, sent in one call,
// in whatever order the plan came out. `parent_id` is nullable in the cloud and
// an IMMEDIATE foreign key locally, so a one-pass local writer would refuse a
// list the cloud accepts — which is why the verb writes the links in a second
// pass, exactly as migrate_categories_atomic does and for the same reason.
export default {
  invariant: 'B-5',
  title: 'a bulk create accepts a child listed before its parent, and wires it',
  design: 'planningService.createCategories:546-566 — one `.insert(rows)`; the two passes are the local port, argued in the verb',
  consequence: 'a tree import plans its second level from the first and sends both together; a writer that demanded parents first would refuse the commonest import there is',
  parity: 'match',

  command: {
    verb: 'create_categories',
    payload: {
      user_id: USER,
      categories: [
        { id: LEAF, name: 'Fuel', type: 'expense', level: 'detail', parent_id: GROUP },
        { id: GROUP, name: 'Motoring', type: 'expense', level: 'sub' },
      ],
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    categories: 'every row carries created_at and updated_at, which are two clocks in two transactions; what the rows SAY is compared through state below',
  },

  state: [
    categoriesOwnedBy(USER, '7'),
    parentOf(LEAF, 'Motoring'),
    parentOf(GROUP, '-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
