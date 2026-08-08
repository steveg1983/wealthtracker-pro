import {
  EVERYDAY, PRUNABLE, TO_FROM_EVERYDAY, namedTransferCategories, prunablePair,
  transferCategoryUnder, balanceIdentityHolds, categoryPresent, transferCategoryCount,
} from './_shared.mjs';

export default {
  invariant: 'C-5',
  title: 'the one shape that makes this verb raise — and the refusal is the FILE\'s, not the function\'s',
  design: 'C-5 (20260708140000:127-146) meeting `parent_id ON DELETE CASCADE`. The To/From row is skipped by the function\'s own filter, but being IN the batch it no longer keeps its parent alive — so the parent is deleted and the cascade walks the protected row into a BEFORE DELETE trigger',
  consequence: 'the alternative is worse in both directions: a cascade that succeeded would delete an account\'s transfer bookkeeping through a category the user never named, and a local port that swallowed the refusal would delete rows the cloud keeps',
  parity: 'match',

  // MEASURED on both engines before the port was written
  // (probe-prune2.sh p2-parent-and-transfer-child-both-named,
  // probe-prune-sqlite3.mjs c-parent-and-transfer-child). Both lose the WHOLE
  // batch — the parent survives too — which is why the verb opens a transaction
  // it can roll back rather than deleting row by row and hoping.
  //
  // No _rpc_guard flag stands C-5 down, and the port does not try: measured with
  // the split guard held, the refusal is identical. It is a protection, not a
  // nuisance.
  setup: {
    sqlite: `${prunablePair.sqlite}\n${namedTransferCategories.sqlite}\n${transferCategoryUnder(PRUNABLE, EVERYDAY).sqlite}`,
    postgres: `${prunablePair.postgres}\n${namedTransferCategories.postgres}\n${transferCategoryUnder(PRUNABLE, EVERYDAY).postgres}`,
  },
  command: {
    verb: 'delete_unused_categories',
    payload: { ids: [PRUNABLE, TO_FROM_EVERYDAY], user_id: null },
  },
  expect: { outcome: 'refused', error: 'transfer_category_protected' },
  state: [
    categoryPresent(PRUNABLE, 'HERE'),
    categoryPresent(TO_FROM_EVERYDAY, 'HERE'),
    transferCategoryCount('2'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
