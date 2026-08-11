import { USER, EVERYDAY, PRE_SPLIT_ROW, everyStateOfCommitment,
  storedFlag, storedTriFlag, balanceIdentityHolds } from './_shared.mjs';

// COALESCE(is_reconciled, is_cleared), and the migration's reason for it: a NULL
// means "ask is_cleared", and the rows this loop touches are BY DEFINITION the
// ones whose is_cleared is changing — so writing the resolved answer down is
// what stops the ambiguity outliving the change.
//
// The row starts (cleared, NULL) — history, which every screen reads as
// reconciled. Un-ticking it must therefore leave it explicitly NOT committed,
// not still-unanswered: `no`, and the difference between `no` and `NULL` here is
// exactly what `storedTriFlag` exists to see.
export default {
  invariant: 'A-1',
  title: 'un-ticking a row from before the split answers the question it never answered',
  design: 'set_transactions_cleared 20260810200000:138-141 — "writing the resolved answer down is what stops the ambiguity outliving the change"',
  consequence: 'pre-split rows keep answering "ask the tick" after the tick has gone, so the same row reads reconciled or not depending on which screen asks',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: { verb: 'set_transactions_cleared', payload: { ids: [PRE_SPLIT_ROW], cleared: false, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(PRE_SPLIT_ROW, 'is_cleared', 'no'),
    storedTriFlag(PRE_SPLIT_ROW, 'is_reconciled', 'no'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
