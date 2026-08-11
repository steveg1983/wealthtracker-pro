import { USER, balanceIdentityHolds, goalShape } from './_shared.mjs';

const NEW = 'e0000000-0000-0000-0000-0000000000f5';

// `row.account_id = g.accountId || null` — FALSY, not nullish, which is the same
// surprise create_category reproduces for parent_id and for the same reason: an
// empty string in a link column is a pointer at a row that cannot exist. On the
// cloud side the cast to uuid would refuse `''` outright; NULLIF is what the
// mapper does before it gets there.
export default {
  invariant: 'R-12',
  title: 'an empty account id is stored as no account rather than as an empty string',
  design: 'planningService.ts:200 — `row.account_id = g.accountId || null`',
  consequence: 'a goal pointing at an account that cannot exist counts a balance that is not there',
  parity: 'match',

  command: {
    verb: 'create_goal',
    payload: {
      id: NEW,
      user_id: USER,
      name: 'Unlinked',
      target_amount: '100.00',
      account_id: '',
      contribution_frequency: '',
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    created_at: 'the instant of the write, on two clocks and in two transactions',
    updated_at: 'the same instant, and the same two clocks',
  },

  result: { id: NEW, account_id: null, contribution_frequency: null },

  state: [
    goalShape(NEW, 'Unlinked:100.00:0.00:-:active:-:-:-:-:manual:-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
