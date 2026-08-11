import {
  USER, THEIR_GOAL, secondUser, setups, strangersGoal,
  balanceIdentityHolds, goalShape,
} from './_shared.mjs';

// The `.eq('user_id', …)` half, which is all that stands between two logins in
// one file.
export default {
  invariant: 'X-6',
  title: 'a goal belonging to somebody else is refused, and left exactly as it was',
  design: 'the second `.eq()` on planningService.updateGoal:372',
  consequence: 'a restored backup can put two logins in one file, and a write that ignored the owner would edit the wrong person’s plans',
  parity: 'match',

  setup: setups(secondUser, strangersGoal),

  command: {
    verb: 'update_goal',
    payload: { id: THEIR_GOAL, user_id: USER, patch: { name: 'Mine now' } },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'goal_not_found' },
    postgres: { outcome: 'refused', error: 'PGRST116' },
  },

  state: [
    goalShape(THEIR_GOAL, 'Theirs:1000.00:0.00:-:active:-:-:-:-:manual:-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
