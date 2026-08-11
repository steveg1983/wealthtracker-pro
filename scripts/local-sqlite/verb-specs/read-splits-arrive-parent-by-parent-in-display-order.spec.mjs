import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP, OUTGOINGS,
  LEG_LINE, PLAIN_LINE, SECOND_PARENT, SECOND_PARENT_FIRST_LINE, SECOND_PARENT_SECOND_LINE,
  setups, plainSplitParent, aSecondSplitParent, pinnedLedgerTimes, listedSplit,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-11',
  title: 'every line in the file, parent by parent, each parent in the order its lines are drawn',
  design: 'transactionService.getAllTransactionSplits: .select(\'*\').eq(\'user_id\', …).order(\'transaction_id\').order(\'sort_order\'), paged only because PostgREST caps a response at 1,000 rows — a cap a file does not have. The whole row, eleven columns, because the query is select(\'*\') and what a read projects is what the query projects',
  consequence: 'this is the answer split-aware reporting aggregates by category, so a line in the wrong place is a figure in the wrong category. The second parent\'s id sorts BEFORE the Corner shop\'s and is written AFTER it, so a read that came back in insertion order — which is what SQLite gives for free — is caught here',
  parity: 'match',

  setup: setups(plainSplitParent, aSecondSplitParent, pinnedLedgerTimes),
  command: { verb: 'list_transaction_splits', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transaction_splits: [
      listedSplit({
        id: SECOND_PARENT_FIRST_LINE, transaction_id: SECOND_PARENT,
        category: WEEKLY_SHOP, amount: '-20.00', memo: 'the food half', sort_order: 0,
      }),
      listedSplit({
        id: SECOND_PARENT_SECOND_LINE, transaction_id: SECOND_PARENT,
        category: OUTGOINGS, amount: '-10.00', sort_order: 1,
      }),
      listedSplit({
        id: LEG_LINE, transaction_id: CORNER_SHOP,
        category: WEEKLY_SHOP, amount: '-15.00', sort_order: 0,
      }),
      listedSplit({
        id: PLAIN_LINE, transaction_id: CORNER_SHOP,
        category: WEEKLY_SHOP, amount: '-10.00', sort_order: 1,
      }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
