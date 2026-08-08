import { USER, MERGE_SOURCE, MERGE_TARGET, CORNER_SHOP, BUDGET, RECURRING, EVERYDAY,
  mergeablePair, filedUnderTheSource, budgetOnTheSource, recurringOnTheSource,
  setups, categoryShape, filedAs, budgetFiledAs, recurringFiledAs, referencesTo,
  auditShape, auditRowsInTotal, balanceOf, balanceIdentityHolds } from './_shared.mjs';

// All four reference surfaces at once, which is the claim the migration's title
// makes: "these two are the same thing" becomes ONE transaction. The previous
// specs prove each surface moves; this one proves they move TOGETHER, and that
// the audit log ends up with exactly one entry per row moved plus the delete —
// four rows, no summary entry, no missing entry.
//
// One summary row was the tempting design and the schema had already settled it:
// the log's job is to answer "what happened to THIS row", and a summary cannot
// answer it for any of them.
export default {
  invariant: 'U-1',
  title: 'a transaction, a budget and a recurring template all move, and each is audited once',
  design: 'merge_categories 20260805214322:44-59 — one entry per row changed, deliberately, over the same volume apply_category_to_uncategorized handles',
  consequence: 'a merge half-applies across surfaces and the log cannot say which half',
  parity: 'match',

  setup: setups(mergeablePair, filedUnderTheSource, budgetOnTheSource, recurringOnTheSource),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, category: MERGE_TARGET },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    filedAs(CORNER_SHOP, 'Groceries/Groceries'),
    budgetFiledAs(BUDGET, 'Groceries/Groceries'),
    recurringFiledAs(RECURRING, 'Groceries'),
    referencesTo(MERGE_SOURCE, '0'),
    auditShape('budget/update,category/delete,recurring_transaction/update,transaction/update'),
    auditRowsInTotal('4'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
