import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE,
  setups, plainSplitParent, aSecondSplitParent, pinnedLedgerTimes, listedSplit,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-12',
  title: 'asking for one parent answers with that parent\'s lines, in the order they are drawn',
  design: 'transactionService.getTransactionSplits(transactionId): .select(\'*\').eq(\'transaction_id\', …).order(\'sort_order\'). The seam names it listTransactionSplitsFor and says why the suffix exists — so that "all of them" and "one row\'s" are told apart by more than their arity at the call site',
  consequence: 'this is what the edit modal draws when a split is opened, so the order is the order the lines are typed in and the sum is checked in. A read that answered with every parent\'s lines would put another transaction\'s money in the box',
  parity: 'match',

  // A SECOND parent is in the file on purpose: a port that ignored the id and
  // answered with the whole store would pass a fixture with only one.
  setup: setups(plainSplitParent, aSecondSplitParent, pinnedLedgerTimes),
  command: { verb: 'splits_for', payload: { user_id: USER, transaction_id: CORNER_SHOP } },
  expect: { outcome: 'ok' },
  result: {
    splits: [
      listedSplit({ id: LEG_LINE, category: WEEKLY_SHOP, amount: '-15.00', sort_order: 0 }),
      listedSplit({ id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-10.00', sort_order: 1 }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
