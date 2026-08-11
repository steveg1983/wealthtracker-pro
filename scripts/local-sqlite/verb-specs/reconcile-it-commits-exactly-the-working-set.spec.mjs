import { USER, EVERYDAY, CORNER_SHOP, MARKED_ROW, COMMITTED_ROW, PRE_SPLIT_ROW,
  everyStateOfCommitment, storedTriFlag, storedFlag, auditRowsForUpdate,
  balanceOf, balanceIdentityHolds } from './_shared.mjs';

// FOUR ROWS, FOUR ANSWERS, and the count is 1.
//
//   MARKED_ROW    ticked, not committed  -> converted. This is the working set.
//   COMMITTED_ROW already committed      -> left alone, and NOT counted again:
//                                           a second count for it would overstate
//                                           the work the person just did.
//   PRE_SPLIT_ROW ticked, NULL           -> LEFT ALONE. `IS NOT DISTINCT FROM
//                                           false` and not `IS DISTINCT FROM
//                                           true`: a NULL row is one the old
//                                           world already called reconciled, and
//                                           sweeping those in would rewrite,
//                                           re-audit and re-stamp the whole
//                                           history of the account the first
//                                           time anybody finalized it.
//   CORNER_SHOP   not ticked             -> left alone. Only what was marked is
//                                           settled.
//
// The audit assertion is per row for the same reason: three of the four must
// have no entry at all, and a count of one across the table would not say which.
export default {
  invariant: 'A-2',
  title: 'finalizing commits exactly the marked rows, and nothing else',
  design: 'finalize_reconciliation 20260810200000:240-259, and :186-193 for why a NULL row is not in the working set',
  consequence: 'the first finalize of an account rewrites its entire history, or commits rows nobody ticked',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: {
    verb: 'finalize_reconciliation',
    payload: { account_id: EVERYDAY, ending_balance: '-28.00', reconciled_on: '2024-03-31', user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { reconciled: 1 },

  state: [
    storedTriFlag(MARKED_ROW, 'is_reconciled', 'yes'),
    storedTriFlag(COMMITTED_ROW, 'is_reconciled', 'yes'),
    storedTriFlag(PRE_SPLIT_ROW, 'is_reconciled', 'NULL'),
    storedTriFlag(CORNER_SHOP, 'is_reconciled', 'no'),
    storedFlag(CORNER_SHOP, 'is_cleared', 'no'),
    auditRowsForUpdate(MARKED_ROW, '1'),
    auditRowsForUpdate(COMMITTED_ROW, '0'),
    auditRowsForUpdate(PRE_SPLIT_ROW, '0'),
    auditRowsForUpdate(CORNER_SHOP, '0'),
    balanceOf(EVERYDAY, '-28.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
