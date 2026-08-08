import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, categoryShape,
  auditShape, auditRowsInTotal, referencesTo, balanceIdentityHolds, EVERYDAY } from './_shared.mjs';

// The floor case, and it earns its place: the source is deleted and audited even
// when nothing moved. That single `category/delete` entry is "the line that says
// the merge happened, and when" — without it, a merge of an unused category
// would leave no trace at all, and the compliance artifact would be unable to
// answer why a category is missing.
export default {
  invariant: 'U-6',
  title: 'a merge that moves nothing still removes the source and says so',
  design: 'merge_categories 20260805214322:373-384 — the DELETE and its audit entry, outside every loop',
  consequence: 'a category disappears with nothing in the log to say who removed it or when',
  parity: 'match',

  setup: mergeablePair,
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:-:active'),
    referencesTo(MERGE_SOURCE, '0'),
    auditShape('category/delete'),
    auditRowsInTotal('1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
