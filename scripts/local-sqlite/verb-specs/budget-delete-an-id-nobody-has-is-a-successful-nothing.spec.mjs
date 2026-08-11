import {
  USER, EXISTING_BUDGET, existingBudget, balanceIdentityHolds, budgetsOwnedBy,
} from './_shared.mjs';

// No `.single()` on the delete's query, so no rows matched is a successful call
// that did nothing — and the seam asks for exactly that: a double-click, or a
// second device that got there first, must not turn a decision into an error.
export default {
  invariant: 'X-6',
  title: 'deleting a budget that is already gone is done, not an error',
  design: 'planningService.deleteBudget:289-300 — `.delete().eq(id).eq(user_id)`, and no .single()',
  consequence: 'a second click on a delete that already worked would otherwise put a red message in front of somebody who did nothing wrong',
  parity: 'match',

  setup: existingBudget,

  command: {
    verb: 'delete_budget',
    payload: { id: 'b0000000-0000-0000-0000-0000000000ff', user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    budgetsOwnedBy(USER, '1'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
