import { USER, EVERYDAY, CORNER_SHOP, storedFlag, rowExists, rowsInAccount,
  auditRowsForUpdate, balanceOf, balanceIdentityHolds } from './_shared.mjs';

// ARCHIVING IS A VIEW FLAG. The row stays in the table, stays counted in the
// balance, stays in every report — and is hidden only from the live register.
//
// `balance_of` is the assertion that matters and it is not a formality: the
// Microsoft Money original HARD-DELETED archived rows and adjusted each
// account's opening balance to compensate, which is the "fragile, unrecoverable
// operation people were warned off" the soft archive exists to avoid. An engine
// that deleted, or that moved the opening balance, fails here.
export default {
  invariant: 'A-4',
  title: 'archiving one row hides it and never deletes it',
  design: 'set_transactions_archived 20260805145035:172-229',
  consequence: 'tidying the register loses the money the row moved',
  parity: 'match',

  command: {
    verb: 'set_transactions_archived',
    payload: { ids: [CORNER_SHOP], archived: true, user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(CORNER_SHOP, 'archived', 'yes'),
    rowExists(CORNER_SHOP, '1'),
    rowsInAccount(EVERYDAY, '1'),
    auditRowsForUpdate(CORNER_SHOP, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
