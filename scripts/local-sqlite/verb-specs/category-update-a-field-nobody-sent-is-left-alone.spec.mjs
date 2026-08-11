import { USER, WEEKLY_SHOP, balanceIdentityHolds, categoryShape } from './_shared.mjs';

// categoryToDb's whole presence rule: `undefined` is dropped, so a key that is
// not in the patch is a column the write does not mention. The same `p ? 'k'`
// class update_account has, with no second class anywhere in it.
export default {
  invariant: 'D-7',
  title: 'an update writes the fields it names and leaves every other column where it was',
  design: 'planningService.updateCategory:568-585 — `.update(categoryToDb(updates)).eq(id).eq(user_id).select().single()`',
  consequence: 'the caller replaces its copy of the category with this answer, so a write that blanked what it was not asked about would erase a name, a parent or a flag the user never touched',
  parity: 'match',

  command: {
    verb: 'update_category',
    payload: {
      id: WEEKLY_SHOP,
      user_id: USER,
      patch: { name: 'Food shopping', icon: 'basket' },
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    updated_at: 'the instant of the write, on two clocks and in two transactions',
    created_at: 'the fixture inserted it on each engine separately',
  },

  result: {
    id: WEEKLY_SHOP,
    name: 'Food shopping',
    icon: 'basket',
    // Untouched, because the patch did not name them.
    type: 'expense',
    level: 'sub',
    parent_id: 'c0000000-0000-0000-0000-000000000002',
    color: null,
    is_active: true,
  },

  state: [
    categoryShape(WEEKLY_SHOP, 'Food shopping:expense:sub:0002:-:active'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
