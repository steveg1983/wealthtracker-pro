import {
  USER, EVERYDAY, OUTGOINGS, RAINY_DAY, transferCategoryUnder,
  balanceIdentityHolds, categoriesOwnedBy, categoryPresent, transferCategoryCount,
} from './_shared.mjs';

const GROUP = 'c0000000-0000-0000-0000-0000000000f1';
const LEAF = 'c0000000-0000-0000-0000-0000000000f2';

// C-5 reached the long way, which is the shape the prune already measured on both
// engines: name a plain group with a protected row somewhere under it, and the
// protection takes the whole call. The cloud arrives at it through
// `parent_id ON DELETE CASCADE`; the local verb deletes the protected row
// DIRECTLY, because it walks the subtree — same trigger, same refusal, and
// nothing left half-deleted on either side.
export default {
  invariant: 'C-7',
  title: 'a group with a To/From category under it cannot be deleted at all',
  design: 'C-5 through the cascade — the same shape probe-prune2.sh and probe-prune-sqlite3.mjs measured for delete_unused_categories on both engines',
  consequence: 'losing the whole call is the right answer: the alternative is a group half deleted, with the protected row left pointing at a parent that is gone',
  parity: 'match',

  setup: {
    sqlite: `INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('${GROUP}', '${USER}', 'Motoring', 'expense', 'sub', '${OUTGOINGS}'),
               ('${LEAF}', '${USER}', 'Fuel', 'expense', 'detail', '${GROUP}');
             ${transferCategoryUnder(GROUP, RAINY_DAY).sqlite}`,
    postgres: `INSERT INTO public.categories (id, user_id, name, type, level, parent_id) VALUES
                 ('${GROUP}', '${USER}', 'Motoring', 'expense', 'sub', '${OUTGOINGS}'),
                 ('${LEAF}', '${USER}', 'Fuel', 'expense', 'detail', '${GROUP}');
               ${transferCategoryUnder(GROUP, RAINY_DAY).postgres}`,
  },

  command: {
    verb: 'delete_category',
    payload: { id: GROUP, user_id: USER },
  },

  expect: { outcome: 'refused', error: 'transfer_category_protected' },

  state: [
    categoryPresent(GROUP, 'HERE'),
    // The leaf is DEEPER than the protected row's own position in the walk, so a
    // verb that deleted as it went would have taken this one before the refusal.
    categoryPresent(LEAF, 'HERE'),
    transferCategoryCount('2'),
    categoriesOwnedBy(USER, '7'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
