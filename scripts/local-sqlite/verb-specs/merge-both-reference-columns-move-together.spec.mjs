import { USER, MERGE_SOURCE, MERGE_TARGET, CORNER_SHOP, mergeablePair, filedUnderTheSource,
  setups, categoryShape, filedAs, referencesTo, auditShape, balanceOf,
  balanceIdentityHolds, EVERYDAY } from './_shared.mjs';

// The whole reason this function exists. `transactions.category` is TEXT with no
// foreign key (R-3) and `category_id` is the uuid twin with ON DELETE SET NULL,
// and the dialog this replaced moved the first and let the database silently
// null the second — so a budget or a report reading either column afterwards got
// a different answer.
//
// Balance-neutral by construction, and asserted anyway: no statement in the verb
// names an amount, a sign or an account.
export default {
  invariant: 'R-3',
  title: 'the text column and the uuid column move as one',
  design: 'merge_categories 20260805214322:218-240 — one UPDATE writing both, one audit row per transaction',
  consequence: 'the two columns disagree about how a transaction is filed and reports built on either give different totals',
  parity: 'match',

  setup: setups(mergeablePair, filedUnderTheSource),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, category: MERGE_TARGET, category_id: MERGE_TARGET },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:-:active'),
    filedAs(CORNER_SHOP, 'Groceries/Groceries'),
    referencesTo(MERGE_SOURCE, '0'),
    auditShape('category/delete,transaction/update'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
