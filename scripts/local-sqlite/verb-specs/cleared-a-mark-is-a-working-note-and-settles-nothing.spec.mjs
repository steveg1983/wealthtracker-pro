import { USER, CORNER_SHOP, EVERYDAY, storedFlag, storedTriFlag, auditRowsForUpdate,
  balanceOf, balanceIdentityHolds } from './_shared.mjs';

// THE RULE THE WHOLE FEATURE RESTS ON. Before 20260810200000 one flag did both
// jobs, so "Mark all cleared" WAS the reconciliation: leave the screen and the
// account showed nothing left to do. A tick now says only that the row appeared
// on a statement somebody is reading.
//
// The assertion that matters is `stored_is_reconciled`, and it is `no` rather
// than `NULL`: the CASE resolves the committed flag on every row it writes, so
// the ambiguity does not outlive the tick.
export default {
  invariant: 'A-1',
  title: 'a mark is a working note, and it settles nothing',
  design: 'set_transactions_cleared 20260810200000:143-183 — the CASE is the whole of the C/R split on the write side',
  consequence: 'ticking rows off a statement silently reconciles the account, and Finalize becomes a button whose only visible effect is a date',
  parity: 'match',

  command: { verb: 'set_transactions_cleared', payload: { ids: [CORNER_SHOP], cleared: true, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(CORNER_SHOP, 'is_cleared', 'yes'),
    storedTriFlag(CORNER_SHOP, 'is_reconciled', 'no'),
    auditRowsForUpdate(CORNER_SHOP, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
