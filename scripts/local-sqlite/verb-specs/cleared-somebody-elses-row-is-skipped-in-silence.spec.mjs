import { USER, THEIR_ROW, SOMEONE_ELSES_ACCOUNT, secondUser, strangersRow, setups,
  storedFlag, auditShape, balanceIdentityHolds } from './_shared.mjs';

// The owner clause is inside the cursor, so a foreign row is not selected: no
// error, no count, no audit row. That is the bulk-verb shape — the same one
// `apply_category_to_uncategorized` has — and it is the OPPOSITE of
// `set_transactions_archived` beside it, which raises `transaction_not_found`
// for exactly this case. Both behaviours are the cloud's and both are ported:
// a tick is a bulk gesture over a list a screen built, and an archive is a
// decision about a named row.
export default {
  invariant: 'X-6',
  title: 'a row belonging to somebody else is not ticked and not mentioned',
  design: 'set_transactions_cleared 20260810200000:160 — (p_user_id IS NULL OR user_id = p_user_id) inside the cursor',
  consequence: 'a mis-routed owner id marks another login\'s statement off',
  parity: 'match',

  setup: setups(secondUser, strangersRow),
  command: { verb: 'set_transactions_cleared', payload: { ids: [THEIR_ROW], cleared: true, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(THEIR_ROW, 'is_cleared', 'no'),
    auditShape('NONE'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
