import { USER, EVERYDAY, CORNER_SHOP, MARKED_ROW, COMMITTED_ROW, PRE_SPLIT_ROW,
  everyStateOfCommitment, storedFlag, archivedRowsIn, accountText,
  balanceOf, balanceIdentityHolds } from './_shared.mjs';

// FOUR ROWS, FOUR ANSWERS, and the count is 2.
//
//   COMMITTED_ROW  committed, 2024-01-16  -> hidden.
//   PRE_SPLIT_ROW  NULL, ticked, 01-17    -> hidden. COALESCE(is_reconciled,
//                                            is_cleared): pre-split history is
//                                            judged by its mark, exactly as the
//                                            archive judged it the day before
//                                            the column existed.
//   MARKED_ROW     ticked only, 01-15     -> LEFT LIVE. Marked but not committed
//                                            is work in progress, and it stays
//                                            where it can still be unmarked.
//                                            This is the behaviour change the
//                                            split brought to this verb.
//   CORNER_SHOP    unticked, 2024-03-01   -> left live, and twice over: not
//                                            committed, and after the cutoff.
//
// The cutoff is 2024-02-28 and it is passed to the VERB rather than planted, so
// the account's stamp below is this call's own work.
export default {
  invariant: 'A-4',
  title: 'archiving by cutoff hides only the committed rows',
  design: 'archive_transactions_before as restated by 20260810200000:290-329 — the predicate is COALESCE(is_reconciled, is_cleared)',
  consequence: 'work in progress disappears from the register mid-reconciliation, or settled history never leaves it',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: {
    verb: 'archive_transactions_before',
    payload: { account_id: EVERYDAY, cutoff: '2024-02-28', user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { archived: 2, cutoff: '2024-02-28' },

  state: [
    storedFlag(COMMITTED_ROW, 'archived', 'yes'),
    storedFlag(PRE_SPLIT_ROW, 'archived', 'yes'),
    storedFlag(MARKED_ROW, 'archived', 'no'),
    storedFlag(CORNER_SHOP, 'archived', 'no'),
    archivedRowsIn(EVERYDAY, '2'),
    accountText(EVERYDAY, 'archive_through_date', '2024-02-28'),
    balanceOf(EVERYDAY, '-28.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
