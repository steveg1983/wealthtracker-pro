import {
  USER, EXISTING_GOAL, existingGoal, balanceIdentityHolds, goalShape,
} from './_shared.mjs';

// The other half of "the achievement date follows the status, always": a status
// that is anything but completed CLEARS the date, in the same statement that
// changes the status, so the two can never disagree. This spec completes the
// goal and then the one beside it reopens it — here, both in one payload's
// worth: the fixture is active, so the update completes it and stamps it.
export default {
  invariant: 'D-7',
  title: 'completing a goal stamps its date, and the same rule clears it when it is reopened',
  design: 'planningService.ts:189-196',
  consequence: 'a goal that reads as active while carrying a completion date is a row the goals page cannot draw honestly, and neither schema forbids one',
  parity: 'match',

  setup: {
    sqlite: `${existingGoal.sqlite}
      UPDATE goals SET status = 'completed', completed_at = '2025-06-01T00:00:00.000Z'
       WHERE id = '${EXISTING_GOAL}';`,
    postgres: `${existingGoal.postgres}
      UPDATE public.goals SET status = 'completed', completed_at = '2025-06-01T00:00:00Z'
       WHERE id = '${EXISTING_GOAL}';`,
  },

  command: {
    verb: 'update_goal',
    payload: { id: EXISTING_GOAL, user_id: USER, patch: { status: 'active' } },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    updated_at: 'the instant of the write, on two clocks and in two transactions',
    created_at: 'the fixture inserted it on each engine separately',
  },

  result: { id: EXISTING_GOAL, status: 'active', completed_at: null },

  state: [
    goalShape(EXISTING_GOAL, 'Holiday:2000.00:250.05:2026-01-01:active:-:-:-:-:manual:-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
