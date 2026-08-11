import {
  USER, SOMEONE_ELSES_ACCOUNT, secondUser, balanceIdentityHolds, goalsOwnedBy,
} from './_shared.mjs';

const NEW = 'e0000000-0000-0000-0000-0000000000f6';

// R-12's twin key: `FOREIGN KEY (account_id, user_id) REFERENCES accounts(id,
// user_id)`, in the cloud since 20260808170000 and in schema.sql as its mirror.
// The account demonstrably exists — the refusal is the OWNERSHIP half of the
// key, which is the only half a spec can prove by reading the database.
export default {
  invariant: 'R-12',
  title: 'a goal may not point at an account this login does not own',
  design: 'goals_account_id_user_fkey (20260808170000:510-514) and its schema.sql twin',
  consequence: 'a goal that counted somebody else’s savings would report progress towards a target out of money that is not theirs',
  parity: 'match',

  setup: secondUser,

  command: {
    verb: 'create_goal',
    payload: {
      id: NEW,
      user_id: USER,
      name: 'Not yours',
      target_amount: '100.00',
      account_id: SOMEONE_ELSES_ACCOUNT,
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
    postgres: { outcome: 'refused', error: 'goals_account_id_user_fkey' },
  },

  state: [
    goalsOwnedBy(USER, '0'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
