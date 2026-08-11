import {
  USER, RAINY_DAY, closedRainyDay,
  accountFlag, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// Idempotent on both engines, and measured rather than assumed: an UPDATE
// matches its row whether or not the value it writes differs.
export default {
  invariant: 'C-4',
  title: 'closing an account that is already closed changes nothing and is not an error',
  design: 'a PostgREST update matches by predicate, not by difference; SQLite’s changes() counts the same way',
  consequence: 'two clicks on Close, or a retry after a lost response, must not turn into an error page in front of somebody whose account is already closed',
  parity: 'match',

  setup: closedRainyDay,

  command: {
    verb: 'close_account',
    payload: { id: RAINY_DAY, user_id: USER },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { id: RAINY_DAY, is_active: false },

  state: [
    accountFlag(RAINY_DAY, 'is_active', 'no'),
    balanceIdentityHolds(RAINY_DAY),
  ],
};
