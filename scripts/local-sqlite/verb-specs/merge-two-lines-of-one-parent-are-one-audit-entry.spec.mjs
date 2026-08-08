import { USER, MERGE_SOURCE, MERGE_TARGET, CORNER_SHOP, EVERYDAY, mergeablePair,
  bothLinesUnderTheSource, setups, categoryShape, splitLines, splitSumHolds,
  auditRowsInTotal, auditShape, balanceOf, balanceIdentityHolds } from './_shared.mjs';

// The house pattern set_transaction_splits established: a split is audited at its
// PARENT, with the whole line set embedded in before and after — not one entry
// per line, which would invent an entity nothing else in the schema writes.
//
// And the thing a merge must NOT do: two lines landing on the same target stay
// TWO lines. Their memos and their history are the user's, and adding them
// together would destroy both while keeping the sum right, which is the kind of
// bug nobody notices until they go looking for a receipt.
export default {
  invariant: 'U-1',
  title: 'two lines of one split are two lines afterwards, and one audit entry',
  design: 'merge_categories 20260805214322:242-289 — GET DIAGNOSTICS ROW_COUNT, audited once on the parent',
  consequence: 'the lines are silently added together, or the log grows one entry per line and stops matching the split writer',
  parity: 'match',

  setup: setups(mergeablePair, bothLinesUnderTheSource),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    splitLines(CORNER_SHOP, '0:-15.00:Groceries:-:-:- | 1:-10.00:Groceries:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    auditShape('category/delete,transaction/update'),
    auditRowsInTotal('2'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
