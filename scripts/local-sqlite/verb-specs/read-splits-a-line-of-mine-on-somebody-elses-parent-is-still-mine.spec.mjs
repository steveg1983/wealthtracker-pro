import {
  USER, EVERYDAY, SOMEONE_ELSES_ACCOUNT, THEIR_SPLIT_PARENT, MERGE_SOURCE,
  setups, secondUser, mergeablePair, myLineOnTheirParent, pinnedLedgerTimes, listedSplit,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-11',
  title: 'the owner this read filters on is the LINE\'s owner, which is not always the parent\'s',
  design: '.eq(\'user_id\', userId) names transaction_splits.user_id, and so does the RLS policy on that table. The two are usually the same person as the parent\'s owner and neither schema requires it — this fixture exists because merge_categories walks parents by one column and lines by the other, and the gap between them is a real refusal it can reach',
  consequence: 'filtering on the parent instead would be a different question with the same name, and the difference only shows up on files where the two disagree — which is to say, in production and never in a fixture written without this one in mind',
  parity: 'match',

  setup: setups(secondUser, mergeablePair, myLineOnTheirParent, pinnedLedgerTimes),
  command: { verb: 'list_transaction_splits', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transaction_splits: [
      listedSplit({
        id: '50000000-0000-0000-0000-0000000000aa',
        transaction_id: THEIR_SPLIT_PARENT,
        category: MERGE_SOURCE, amount: '-10.00', sort_order: 0,
      }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    auditRowsInTotal('0'),
  ],
};
