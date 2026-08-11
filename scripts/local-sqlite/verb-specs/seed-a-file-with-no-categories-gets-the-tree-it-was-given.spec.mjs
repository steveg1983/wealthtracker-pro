import {
  USER, EMPTY_LOGIN, emptyLogin, balanceIdentityHolds, categoriesOwnedBy, categoryTree,
} from './_shared.mjs';

// B-4, and the reason the verb is called `seed_categories` rather than
// `migrate_categories`: the cloud MINTS a fresh uuid for every incoming id and
// rewrites every transaction and budget that referenced the old one; a file has
// one id space, so the slugs survive and there is nothing to remap.
//
// The ids are therefore the one thing the two engines are guaranteed to disagree
// about, and everything else about the tree is guaranteed to match. The row
// divergence says the first; the tree assertion says the second.
export default {
  invariant: 'B-4',
  title: 'a seed puts the tree it was given into a file that has none',
  design: 'planningService.ensureCategories:426-487 — read, and migrate_categories_atomic (20260724100000:48-136) only when the read came back empty',
  consequence: 'a ledger with no categories has nowhere to file anything, and the boot does not ask twice: whatever comes back IS the list the register, the budgets page and every filter are built from',
  parity: 'match',

  setup: emptyLogin,

  command: {
    verb: 'seed_categories',
    payload: {
      user_id: EMPTY_LOGIN,
      categories: [
        // A child BEFORE its parent, which both engines have to tolerate — the
        // cloud because its RPC defers the links, the file because parent_id is
        // an IMMEDIATE key there.
        {
          id: 'transfer-in', name: 'Transfer In', type: 'both', level: 'detail',
          parent_id: 'type-transfer', is_system: true,
        },
        {
          id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type',
          is_system: true,
        },
        {
          id: 'type-expense', name: 'Expense', type: 'expense', level: 'type',
          is_system: true,
        },
        {
          id: 'sub-motoring', name: 'Motoring', type: 'expense', level: 'sub',
          parent_id: 'type-expense',
        },
        // A parent that is NOT in the batch: the cloud's `v_map ? parentId`
        // guard leaves the link NULL, and so does the verb.
        {
          id: 'orphan-leaf', name: 'Nowhere', type: 'expense', level: 'detail',
          parent_id: 'a-group-nobody-sent',
        },
      ],
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    categories: 'B-4 — the cloud mints a fresh uuid per row (pass 1) and remaps every reference to it (pass 4); the local edition keeps the ids it was given, because a file has one id space and only users.id carries a uuid CHECK (PHASE3-PLAN D-5). Every other property of the tree is compared by NAME through the state below, which is what the divergence leaves comparable.',
  },

  state: [
    categoriesOwnedBy(EMPTY_LOGIN, '5'),
    categoryTree(
      EMPTY_LOGIN,
      'Expense:expense:type:-:s:active | Motoring:expense:sub:Expense:-:active | '
      + 'Nowhere:expense:detail:-:-:active | Transfer:both:type:-:s:active | '
      + 'Transfer In:both:detail:Transfer:s:active'
    ),
    // The seed is scoped to its own login and the fixture's own tree is beside it,
    // untouched — which is the same rule every read in this crate keeps.
    categoriesOwnedBy(USER, '5'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
