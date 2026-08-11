import {
  USER, EXISTING_GOAL, existingGoal, balanceIdentityHolds, goalShape, goalsOwnedBy,
} from './_shared.mjs';

// `.single()` again, and delete_goal again does not have it.
export default {
  invariant: 'D-7',
  title: 'updating a goal that is not there is refused, and the store is untouched',
  design: 'the `.single()` on planningService.updateGoal:373',
  consequence: 'a contribution submitted after a delete would otherwise create a goal nobody set, holding money the ledger cannot explain',
  parity: 'match',

  setup: existingGoal,

  command: {
    verb: 'update_goal',
    payload: {
      id: 'e0000000-0000-0000-0000-0000000000ff',
      user_id: USER,
      patch: { current_amount: '300.00' },
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'goal_not_found' },
    postgres: { outcome: 'refused', error: 'PGRST116' },
  },

  state: [
    goalsOwnedBy(USER, '1'),
    goalShape(EXISTING_GOAL, 'Holiday:2000.00:250.05:2026-01-01:active:-:-:-:-:manual:-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
