import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// The answer that looks like a bug and is not. `idempotent` is `v_rows > 0 AND
// v_keyed = v_rows`, so an empty request is FALSE: nothing was keyed, therefore
// nothing about it is safe to re-post on the strength of its keys. A port that
// read the flag as "does this function support idempotency" would answer true
// here and be wrong in the direction that costs money.
export default {
  invariant: 'I-4',
  title: 'an empty chunk writes nothing, moves nothing, and reports itself NOT idempotent',
  design: 'import_transactions_atomic 20260808140000:389-399 — "An empty request is false for the same reason: nothing was keyed"',
  consequence: 'a true here tells a client that an empty POST is safe to repeat FOR THE SAME REASON a keyed one is, which is a promise about keys that do not exist',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: { user_id: USER, account_id: EVERYDAY, rows: [] },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 0, skipped: 0, idempotent: false },

  state: [
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    // IF v_inserted > 0 — so the balance UPDATE never ran and there is nothing
    // to audit. An empty import is not an event.
    auditTrail('NONE'),
  ],
};
