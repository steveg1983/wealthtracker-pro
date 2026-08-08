import { USER, MERGE_SOURCE, MERGE_TARGET, RECURRING, mergeablePair, recurringOnTheSource,
  setups, categoryShape, recurringFiledAs, referencesTo, auditShape,
  balanceIdentityHolds, EVERYDAY } from './_shared.mjs';

// The fourth surface, and the one whose OWNER column is a different kind of id
// in each engine: the Clerk id in the cloud (text, FK to user_profiles), a
// users(id) uuid locally. So the loop matches on the category id ALONE and is
// deliberately not scoped by owner in either edition — safe because a category
// id is a globally unique uuid, which is the same argument
// delete_unused_categories relies on.
//
// The local edition COULD scope it and does not, on purpose: the verb reproduces
// the cloud's selection rather than a tightening of it.
export default {
  invariant: 'C-13',
  title: 'a recurring template filed under the merged-away category is re-pointed',
  design: 'merge_categories 20260805214322:319-344 — matched on the category id alone, one recurring_transaction/update entry',
  consequence: 'next month\'s automatic rows are created under a category that no longer exists',
  parity: 'match',

  setup: setups(mergeablePair, recurringOnTheSource),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    recurringFiledAs(RECURRING, 'Groceries'),
    referencesTo(MERGE_SOURCE, '0'),
    auditShape('category/delete,recurring_transaction/update'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
