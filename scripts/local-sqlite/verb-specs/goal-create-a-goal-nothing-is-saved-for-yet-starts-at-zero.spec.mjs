import { USER, balanceIdentityHolds, goalShape } from './_shared.mjs';

const NEW = 'e0000000-0000-0000-0000-0000000000f3';

// The FIRST half of rule 49, and the half that stops the other from being
// satisfied by an engine that starts every goal at something: "the rule is
// 'start at what you were given', not 'start at something'".
//
// And note WHERE the zero comes from on both engines: the column's own default,
// not a literal either writer sends. A verb that wrote a zero of its own would
// be one edit away from writing it over a stated figure.
export default {
  invariant: 'B-3',
  title: 'a goal created with nothing put by starts at zero, from the column and not from a literal',
  design: 'schema.sql `current_amount_minor INTEGER NOT NULL DEFAULT 0` against the cloud’s `current_amount numeric(20,2) DEFAULT 0`',
  consequence: 'the goals page draws a bar from this figure; an invented opening amount is a bar that starts somewhere nobody chose',
  parity: 'match',

  command: {
    verb: 'create_goal',
    payload: { id: NEW, user_id: USER, name: 'Rainy day', target_amount: '500.00' },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    created_at: 'the instant of the write, on two clocks and in two transactions',
    updated_at: 'the same instant, and the same two clocks',
  },

  result: { id: NEW, current_amount: '0.00', target_amount: '500.00', target_date: null },

  state: [
    goalShape(NEW, 'Rainy day:500.00:0.00:-:active:-:-:-:-:manual:-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
