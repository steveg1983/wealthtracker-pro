import { USER, OUTGOINGS, balanceIdentityHolds, categoriesOwnedBy, parentOf } from './_shared.mjs';

const NEW = 'c0000000-0000-0000-0000-0000000000f1';

// The happy path of the family, and the one that fixes what a create MEANS: the
// eleven columns categoryToDb can send, the five defaults it leaves to the
// table, and the whole row handed back.
export default {
  invariant: 'B-5',
  title: 'a create stores every column it was given and answers with the row as stored',
  design: 'PHASE3-PLAN D-2; the oracle is planningService.createCategory:489-505 (a PostgREST INSERT of categoryToDb, no RPC), transcribed in lib/verb-postgres.mjs',
  consequence: 'the caller puts this answer straight into state and files its next transactions under the id in it — a row reconstructed from the request rather than read back would disagree with the file the moment a default or a CHECK had an opinion',
  parity: 'match',

  command: {
    verb: 'create_category',
    payload: {
      id: NEW,
      user_id: USER,
      name: 'Fuel',
      type: 'expense',
      level: 'detail',
      parent_id: OUTGOINGS,
      color: '#123456',
      icon: 'car',
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
    name: 'Fuel',
    type: 'expense',
    level: 'detail',
    parent_id: OUTGOINGS,
    color: '#123456',
    icon: 'car',
    // The five the caller did not send, answered by the column defaults — and
    // the two engines' defaults are the same five values.
    account_id: null,
    is_system: false,
    is_transfer_category: false,
    is_revaluation_category: false,
    is_unassigned_bucket: false,
    is_active: true,
  },

  state: [
    categoriesOwnedBy(USER, '6'),
    parentOf(NEW, 'Outgoings'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
