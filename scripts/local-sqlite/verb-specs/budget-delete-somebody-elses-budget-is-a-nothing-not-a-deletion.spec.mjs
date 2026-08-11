import {
  USER, THEIR_BUDGET, STRANGER, secondUser, setups, strangersBudget,
  balanceIdentityHolds, budgetsOwnedBy,
} from './_shared.mjs';

// The delete's owner clause, and the shape it takes when it fires: this query
// has no `.single()`, so "not yours" and "not there" are the same successful
// nothing — which is what the cloud does, and is why the count is the thing to
// assert rather than a refusal.
export default {
  invariant: 'X-6',
  title: 'a delete aimed at somebody else’s budget removes nothing and says so with a zero',
  design: 'the second `.eq()` on planningService.deleteBudget:298',
  consequence: 'one file can hold two logins after a restore, and a delete that ignored the owner would erase the other one’s planning',
  parity: 'match',

  setup: setups(secondUser, strangersBudget),

  command: {
    verb: 'delete_budget',
    payload: { id: THEIR_BUDGET, user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    budgetsOwnedBy(STRANGER, '1'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
