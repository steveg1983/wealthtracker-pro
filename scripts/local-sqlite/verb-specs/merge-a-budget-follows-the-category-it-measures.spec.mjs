import { USER, MERGE_SOURCE, MERGE_TARGET, BUDGET, mergeablePair, budgetOnTheSource,
  setups, categoryShape, budgetFiledAs, referencesTo, auditShape,
  balanceIdentityHolds, EVERYDAY } from './_shared.mjs';

// The surface the delete-and-reassign dialog never moved, and the reason the
// migration exists at all: `budgets.category` is TEXT with no foreign key, so a
// budget pointing at a deleted category kept a dangling id and "silently
// reported £0 spent for ever after", while `budgets.category_id` was quietly
// nulled by the FK instead.
//
// The audit entry is not decoration either — budgets have no other audited write
// path in this schema, and this one was not going to be the first silent change
// to what a budget measures.
export default {
  invariant: 'C-13',
  title: 'a budget measuring the merged-away category measures the target afterwards',
  design: 'merge_categories 20260805214322:291-317 — both columns moved, one budget/update entry each',
  consequence: 'the budget silently reports zero spent for ever, and nothing in the log says when it stopped working',
  parity: 'match',

  setup: setups(mergeablePair, budgetOnTheSource),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    budgetFiledAs(BUDGET, 'Groceries/Groceries'),
    referencesTo(MERGE_SOURCE, '0'),
    auditShape('budget/update,category/delete'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
