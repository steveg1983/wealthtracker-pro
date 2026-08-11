import { USER, balanceIdentityHolds, budgetsOwnedBy } from './_shared.mjs';

const NEW = 'b0000000-0000-0000-0000-0000000000f5';

// M-1 at the write boundary, asked of the planning family. A JSON number IS a
// double, so 70.1 arrives at a parser as 70.099999999999994 and the ledger would
// be storing a rounding of what somebody typed. The crate refuses the TYPE
// rather than the value, before a connection is touched; Postgres accepts it,
// which is exactly the divergence the local edition exists to be on the other
// side of.
export default {
  invariant: 'M-1',
  title: 'a budget amount sent as a JSON number is refused before anything is written',
  design: 'crate::money — a decimal string is the only spelling this boundary deserialises, and serde refuses the rest in command.rs::parse',
  consequence: 'a limit a penny out announces itself as exceeded when it is not, on the one page where a person is watching the figure',
  parity: 'divergent',
  reason: 'the cloud has no boundary of its own: PostgREST hands the double to a numeric cast and stores its rounding, which is what the crate was written not to do',

  command: {
    verb: 'create_budget',
    payload: { id: NEW, user_id: USER, name: 'Food', amount: 70.1, period: 'monthly', start_date: '2024-01-01' },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'amount_must_be_a_string' },
    postgres: { outcome: 'ok' },
  },

  state: [
    budgetsOwnedBy(USER, { sqlite: '0', postgres: '1' }),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
