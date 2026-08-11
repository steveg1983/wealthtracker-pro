import {
  USER, STRANGER, THEIR_GOAL, secondUser, setups, strangersGoal,
  balanceIdentityHolds, goalsOwnedBy,
} from './_shared.mjs';

// The delete's owner clause. No `.single()`, so "not yours" and "not there" are
// the same successful nothing — which is what the cloud does.
export default {
  invariant: 'X-6',
  title: 'a delete aimed at somebody else’s goal removes nothing and says so with a zero',
  design: 'the second `.eq()` on planningService.deleteGoal:388',
  consequence: 'one file can hold two logins after a restore, and a delete that ignored the owner would erase the other one’s plans in silence',
  parity: 'match',

  setup: setups(secondUser, strangersGoal),

  command: {
    verb: 'delete_goal',
    payload: { id: THEIR_GOAL, user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    goalsOwnedBy(STRANGER, '1'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
