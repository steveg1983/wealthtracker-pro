import {
  EVERYDAY, PRUNABLE, PRUNABLE_CHILD, prunableChild, prunablePair, setups,
  balanceIdentityHolds, categoryPresent, rowCount,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'naming a parent and its child deletes two, and SAYS two',
  design: '20260713100000:360-361, `GET DIAGNOSTICS v_count = ROW_COUNT`. Postgres decides which rows to delete from one snapshot and counts each of them',
  consequence: 'the count is what the import summary shows the user. The same file, the same two rows gone, and a different number on the screen is the difference between "pruned 2" and a user counting their categories by hand to see what happened',
  parity: 'match',

  // THE ONE THING THE PORT COULD NOT DO THE CLOUD'S WAY. Spelled as SQLite's own
  // single DELETE this answers 1, not 2: SQLite deletes the parent, the cascade
  // removes the child, and the scan then finds the child already gone. MEASURED
  // (probe-prune-sqlite.mjs s-child-inside-the-batch → 1, against the cloud's 2,
  // with SIX categories left on both). The port qualifies the rows first and
  // deletes them deepest-first so no cascade can pre-empt a row it is going to
  // count — which is what makes this spec a match rather than a divergence.
  setup: setups(prunablePair, prunableChild),
  command: {
    verb: 'delete_unused_categories',
    payload: { ids: [PRUNABLE, PRUNABLE_CHILD], user_id: null },
  },
  expect: { outcome: 'ok' },
  result: { deleted: 2 },
  state: [
    categoryPresent(PRUNABLE, 'GONE'),
    categoryPresent(PRUNABLE_CHILD, 'GONE'),
    rowCount('categories_left', 'categories', '6'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
