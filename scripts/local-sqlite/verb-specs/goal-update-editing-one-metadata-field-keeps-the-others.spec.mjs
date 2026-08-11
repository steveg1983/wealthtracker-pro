import {
  USER, EXISTING_GOAL, existingGoal, balanceIdentityHolds, goalMetadata,
} from './_shared.mjs';

// The bug with a date on it, in one sentence from planningService itself:
// "Editing a goal's type deleted its linked accounts." Three unrelated app
// fields share one jsonb column, and a mapper that REBUILT the object from a
// partial update wiped whichever of the three the update did not mention.
//
// The cloud's fix is a second round trip; here the row is already read for the
// audit entry's `before`, so the merge is free — and it is a SHALLOW spread on
// both sides, deliberately not SQLite's json_patch (RFC 7396 deletes a key whose
// value is null and merges nested objects; the spread does neither).
export default {
  invariant: 'D-7',
  title: 'a metadata field is merged over what is stored rather than replacing the blob',
  design: 'planningService.ts:167-215 — goalToDb takes `existingMetadata` and spreads over it; updateGoal:356-366 reads it first',
  consequence: 'a goal edited to change its type would otherwise lose the accounts it was linked to, with nothing on screen to say so',
  parity: 'match',

  setup: existingGoal,

  command: {
    verb: 'update_goal',
    payload: {
      id: EXISTING_GOAL,
      user_id: USER,
      patch: { metadata: { type: 'investment' } },
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    updated_at: 'the instant of the write, on two clocks and in two transactions',
    created_at: 'the fixture inserted it on each engine separately',
    metadata: 'one object, two spellings: SQLite stores the TEXT it was handed and Postgres re-orders a jsonb by key length then bytes — the state assertion below compares it key by key',
  },

  state: [
    goalMetadata(EXISTING_GOAL, 'linkedAccountIds=["keep-me"],type=investment'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
