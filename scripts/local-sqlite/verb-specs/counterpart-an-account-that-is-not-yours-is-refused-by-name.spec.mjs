import { USER, EVERYDAY, CORNER_SHOP, SOMEONE_ELSES_ACCOUNT, secondUser,
  balanceOf, balanceIdentityHolds, rowsInAccount, transferShape, auditRowsInTotal } from './_shared.mjs';

// X-6 on the ACCOUNT rather than the row, and the refusal is deliberately the
// same for "no such account" and "somebody else's account": telling them apart
// confirms an id exists to a caller who may not see it.
//
// Without it this verb would insert a row into another login's register and move
// another login's balance — the single worst thing a multi-tenant ledger can do.
export default {
  invariant: 'X-6',
  title: 'a counterpart cannot be minted into an account that is not yours',
  design: 'create_transfer_counterpart 20260721090000:56-61 — SELECT … WHERE user_id = v_src.user_id, IF NOT FOUND',
  consequence: 'a row appears in another login\'s register and their balance moves for it',
  parity: 'match',

  setup: secondUser,
  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: CORNER_SHOP, target_account_id: SOMEONE_ELSES_ACCOUNT, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'account_not_found_or_not_owned' },

  state: [
    transferShape(CORNER_SHOP, 'expense:Weekly shop:-:-:-'),
    rowsInAccount(SOMEONE_ELSES_ACCOUNT, '0'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(SOMEONE_ELSES_ACCOUNT, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    auditRowsInTotal('0'),
  ],
};
