import {
  USER, EVERYDAY,
  setups, plainSplitParent, pinnedLedgerTimes, listedTransaction,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-9',
  title: 'a split parent files under nothing, and "nothing" is the empty string rather than NULL',
  design: 'S-4: a split parent\'s own category is blanked when its lines take over the filing, and both schemas store the empty string rather than NULL — trg_protect_split_category and its cloud twin depend on telling the two apart, and so does every screen that asks whether a row is categorised (category IS NULL OR btrim(category) = \'\' is the predicate two verbs turn on)',
  consequence: 'a mapper that folded "" into null, or null into "", would be a difference no assertion about a category id could see. The register would show a split parent as uncategorised in one engine and as filed-under-nothing in the other, and the review sweep would offer to categorise it in exactly one of them',
  parity: 'match',

  setup: setups(plainSplitParent, pinnedLedgerTimes),
  command: { verb: 'list_transactions', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transactions: [
      listedTransaction({ category: '', is_split: true, category_confirmed: false }),
    ],
  },
  state: [
    // The lines sum to the parent, so nothing moved.
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
