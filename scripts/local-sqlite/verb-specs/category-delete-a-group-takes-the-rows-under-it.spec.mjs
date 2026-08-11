import {
  USER, OUTGOINGS, balanceIdentityHolds, categoriesOwnedBy, categoryPresent,
} from './_shared.mjs';

const GROUP = 'c0000000-0000-0000-0000-0000000000f1';
const LEAF = 'c0000000-0000-0000-0000-0000000000f2';

// The cascade is a rule of the SEAM, not an artefact of one engine's foreign
// key, and the COUNT is where the two ports differ: the cloud's ROW_COUNT says
// one for a group of two, so the verb walks the subtree and counts what really
// went. Both engines end with the same rows; the number is the thing this spec
// pins.
export default {
  invariant: 'C-13',
  title: 'deleting a group deletes what is under it, and counts every row that went',
  design: 'planningService.deleteCategory:633-649 and its own comment: "parent_id FK is ON DELETE CASCADE — children go with the parent"',
  consequence: 'a group that outlived itself as a set of orphans is a set of headings the Categories page cannot expand and cannot delete, because nothing lists them any more',
  parity: 'match',

  setup: {
    sqlite: `INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('${GROUP}', '${USER}', 'Motoring', 'expense', 'sub', '${OUTGOINGS}'),
               ('${LEAF}', '${USER}', 'Fuel', 'expense', 'detail', '${GROUP}');`,
    postgres: `INSERT INTO public.categories (id, user_id, name, type, level, parent_id) VALUES
                 ('${GROUP}', '${USER}', 'Motoring', 'expense', 'sub', '${OUTGOINGS}'),
                 ('${LEAF}', '${USER}', 'Fuel', 'expense', 'detail', '${GROUP}');`,
  },

  command: {
    verb: 'delete_category',
    payload: { id: GROUP, user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 2 },

  state: [
    categoryPresent(GROUP, 'GONE'),
    categoryPresent(LEAF, 'GONE'),
    categoriesOwnedBy(USER, '5'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
