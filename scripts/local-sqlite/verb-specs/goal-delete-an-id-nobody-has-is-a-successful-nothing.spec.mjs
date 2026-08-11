import {
  USER, existingGoal, balanceIdentityHolds, goalsOwnedBy,
} from './_shared.mjs';

// No `.single()` on the delete's query. Same rule as the budget delete and the
// dismissal before it.
export default {
  invariant: 'X-6',
  title: 'deleting a goal that is already gone is done, not an error',
  design: 'planningService.deleteGoal:379-390 — `.delete().eq(id).eq(user_id)`, and no .single()',
  consequence: 'a double-click, or a second device that got there first, must not turn a decision into an error message',
  parity: 'match',

  setup: existingGoal,

  command: {
    verb: 'delete_goal',
    payload: { id: 'e0000000-0000-0000-0000-0000000000ff', user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    goalsOwnedBy(USER, '1'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
