import { USER, balanceIdentityHolds, categoriesOwnedBy, parentOf } from './_shared.mjs';

const NEW = 'c0000000-0000-0000-0000-0000000000f1';

// categoryToDb writes `row.parent_id = c.parentId || null` — FALSY, not nullish.
// The one line in that mapper that surprises a reader, and the one a port would
// tidy into `?? null` without noticing.
export default {
  invariant: 'B-5',
  title: 'an empty parent id is stored as no parent at all',
  design: 'planningService.ts categoryToDb: `if (c.parentId !== undefined) row.parent_id = c.parentId || null`',
  consequence: 'a category whose parent is the empty string is a category under a parent that cannot exist — it renders as junk in the tree and can never be reached from the group it belongs to',
  parity: 'match',

  command: {
    verb: 'create_category',
    payload: {
      id: NEW,
      user_id: USER,
      name: 'Loose leaf',
      type: 'expense',
      level: 'detail',
      parent_id: '',
      account_id: '',
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    created_at: 'the instant of the write, on two clocks and in two transactions',
    updated_at: 'the same instant, and the same two clocks',
  },

  result: {
    id: NEW,
    parent_id: null,
    account_id: null,
  },

  state: [
    parentOf(NEW, '-'),
    categoriesOwnedBy(USER, '6'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
