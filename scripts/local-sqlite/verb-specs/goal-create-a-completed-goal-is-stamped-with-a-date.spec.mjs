import { USER, balanceIdentityHolds, goalShape } from './_shared.mjs';

const NEW = 'e0000000-0000-0000-0000-0000000000f4';

// goalToDb's last unusual line: the achievement date FOLLOWS the status, always.
// A completed goal is stamped — with the date the caller gave, or with now.
export default {
  invariant: 'B-3',
  title: 'a goal created as completed carries a completion date',
  design: 'planningService.ts:189-196 — `if (row.status === \'completed\') row.completed_at = g.completedAt ?? new Date().toISOString()`',
  consequence: 'a finished goal with no date is a trophy with no day on it, and the goals page has nowhere to put it',
  parity: 'match',

  command: {
    verb: 'create_goal',
    payload: {
      id: NEW,
      user_id: USER,
      name: 'Done already',
      target_amount: '100.00',
      current_amount: '100.00',
      status: 'completed',
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    created_at: 'the instant of the write, on two clocks and in two transactions',
    updated_at: 'the same instant, and the same two clocks',
    completed_at: 'stamped with now() on each engine, so it is the same fact at two instants — the shape assertion below is what the rule actually says',
  },

  result: { id: NEW, status: 'completed' },

  state: [
    goalShape(NEW, 'Done already:100.00:100.00:-:completed:stamped:-:-:-:manual:-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
