import { USER, WEEKLY_SHOP, balanceIdentityHolds, parentOf } from './_shared.mjs';

// The other half of categoryToDb's one surprise, on the update side: `''` is
// FALSY, so it clears the column rather than being stored.
export default {
  invariant: 'D-7',
  title: 'an empty parent in a patch un-parents the category',
  design: 'planningService.ts categoryToDb: `row.parent_id = c.parentId || null`, applied to a patch',
  consequence: 'the Categories page sends `parentId: \'\'` when somebody drags a leaf out to the top level; a port that stored the empty string would leave the leaf pointing at a parent that cannot exist and invisible under the one it left',
  parity: 'match',

  command: {
    verb: 'update_category',
    payload: {
      id: WEEKLY_SHOP,
      user_id: USER,
      patch: { parent_id: '' },
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    updated_at: 'the instant of the write, on two clocks and in two transactions',
    created_at: 'the fixture inserted it on each engine separately',
  },

  result: { id: WEEKLY_SHOP, parent_id: null },

  state: [
    parentOf(WEEKLY_SHOP, '-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
