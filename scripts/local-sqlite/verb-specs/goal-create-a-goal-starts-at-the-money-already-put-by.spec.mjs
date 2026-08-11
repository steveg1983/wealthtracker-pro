import { USER, balanceIdentityHolds, goalShape, goalsOwnedBy } from './_shared.mjs';

const NEW = 'e0000000-0000-0000-0000-0000000000f2';

// Contract rule 49, at the verb. `progress` and `currentAmount` are ONE quantity
// with two names, and by the time a row exists both have collapsed into
// `current_amount` — createGoal's `goal.currentAmount ?? 0` feeds goalToDb's
// `g.progress ?? g.currentAmount`, so what reaches the table is one key.
//
// The version that hard-coded zero here did not merely round down: it lost the
// opening figure DIFFERENTLY in each engine, banking it in one and discarding it
// in the other. That is the difference this spec exists to make impossible.
export default {
  invariant: 'B-3',
  title: 'a goal created with money already put by starts at that figure, to the penny',
  design: 'planningService.createGoal:331-332 — `const startingAmount = goal.currentAmount ?? 0` then goalToDb({...goal, progress: startingAmount})',
  consequence: 'the opening figure is money somebody has already set aside and nothing else in the app knows about it; a goal that started at zero would ask them to save it twice',
  parity: 'match',

  command: {
    verb: 'create_goal',
    payload: {
      id: NEW,
      user_id: USER,
      name: 'New boiler',
      target_amount: '1500.05',
      current_amount: '250.05',
      target_date: '2026-01-01',
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    created_at: 'the instant of the write, on two clocks and in two transactions',
    updated_at: 'the same instant, and the same two clocks',
  },

  result: {
    id: NEW,
    user_id: USER,
    name: 'New boiler',
    target_amount: '1500.05',
    current_amount: '250.05',
    target_date: '2026-01-01',
    // The defaults the caller did not state — the same values on both engines.
    status: 'active',
    completed_at: null,
    auto_contribute: false,
    priority: null,
    account_id: null,
    contribution_frequency: null,
  },

  state: [
    goalsOwnedBy(USER, '1'),
    goalShape(NEW, 'New boiler:1500.05:250.05:2026-01-01:active:-:-:-:-:manual:-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
