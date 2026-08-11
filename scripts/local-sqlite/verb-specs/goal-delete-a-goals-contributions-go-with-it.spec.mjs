import {
  USER, EXISTING_GOAL, existingGoal, goalContributions, setups,
  balanceIdentityHolds, contributionsOf, goalShape, goalsOwnedBy,
} from './_shared.mjs';

// THE CASCADE, MEASURED RATHER THAN DECLARED.
//
// `goal_contributions.goal_id` is ON DELETE CASCADE on both engines, and
// delete_goal deliberately does NOT walk the child rows — which is the opposite
// of delete_category's decision about ITS cascade, and its module docs argue the
// three differences. What that leaves is an obligation: the key has to actually
// fire, and locally that depends on `PRAGMA foreign_keys` having taken.
//
// db::configure reads the pragma back and refuses a connection where it did not,
// so this is belt and braces — and it is the belt that a spec can see. Nothing
// in the app writes a goal contribution, so this fixture is the only place the
// row is ever observed leaving.
export default {
  invariant: 'R-8',
  title: 'deleting a goal takes the contributions filed against it',
  design: 'goal_contributions_goal_id_fkey ON DELETE CASCADE (20251030003814:1780) and its schema.sql twin at :1229',
  consequence: 'a contribution whose goal is gone is a row nothing lists, nothing can delete and nothing can explain — and it carries an amount',
  parity: 'match',

  setup: setups(existingGoal, goalContributions),

  command: {
    verb: 'delete_goal',
    payload: { id: EXISTING_GOAL, user_id: USER },
  },

  expect: { outcome: 'ok' },

  // ONE, and not three: `deleted` counts the goals this verb removed. The
  // contributions are the key's work, and folding them in would make the number
  // mean two things at once.
  result: { deleted: 1 },

  state: [
    goalShape(EXISTING_GOAL, 'GONE'),
    goalsOwnedBy(USER, '0'),
    contributionsOf(EXISTING_GOAL, '0'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
