import {
  USER, EXISTING_GOAL, existingGoal, auditTrailFor, balanceIdentityHolds, goalShape,
} from './_shared.mjs';

// DIVERGENCE 10 for the other entity, asserted once. See the budget spec of the
// same shape for the argument; PHASE1-PLAN §2.2 named goals.target_amount and
// goals.current_amount as two of the four figures U-1 was false of, and this is
// a delete because a delete is the case where the entry is the ONLY record of
// what the figure was.
export default {
  invariant: 'U-1',
  title: 'a goal’s delete is recorded on a device and nowhere in the cloud',
  design: 'PHASE1-PLAN §2.2; there is no write_financial_audit call for goals anywhere in supabase/migrations',
  consequence: 'once the row is gone the entry is the only answer to "what was that target, and who removed it"',
  parity: 'divergent',
  reason: 'the cloud has no function to write an audit row from — DESIGN.md §5 divergence 10',

  setup: existingGoal,

  command: {
    verb: 'delete_goal',
    payload: { id: EXISTING_GOAL, user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 1 },

  state: [
    goalShape(EXISTING_GOAL, 'GONE'),
    auditTrailFor('goal', { sqlite: 'delete', postgres: 'NONE' }),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
