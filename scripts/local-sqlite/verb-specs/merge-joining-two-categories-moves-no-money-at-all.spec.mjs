import { USER, MERGE_SOURCE, MERGE_TARGET, CORNER_SHOP, EVERYDAY, RAINY_DAY,
  mergeablePair, filedUnderTheSource, transferPair, setups, storedAmount,
  balanceOf, balanceIdentityHolds, auditShape, categoryShape } from './_shared.mjs';

// B-1, asserted over a file that has a transfer pair in it as well as an
// ordinary expense — because "no arithmetic in the code" and "no arithmetic in
// the file" are different claims, and only the second is checkable.
//
// The audit SHAPE is the other half: `account/update` appearing anywhere in this
// list would mean a balance moved, and counting audit rows would not catch it.
export default {
  invariant: 'B-1',
  title: 'a merge writes no amount, no sign and no account, on any row',
  design: 'merge_categories 20260805214322:39-42 — "no amount, sign or account_id is written by any statement here"',
  consequence: 'a re-categorisation moves a balance, and the ledger identity breaks somewhere nobody is looking',
  parity: 'match',

  setup: setups(mergeablePair, filedUnderTheSource, transferPair),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    storedAmount(CORNER_SHOP, '-25.00'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('category/delete,transaction/update'),
  ],
};
