import {
  EVERYDAY, PRUNABLE, PRUNABLE_CHILD, PRUNABLE_GRANDCHILD,
  prunableChild, prunableGrandchild, prunablePair, setups,
  balanceIdentityHolds, categoryPresent, rowCount,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a whole branch named at once is counted branch, twig and leaf',
  design: 'the same ROW_COUNT, one level deeper. The deepest-first ordering the local port uses has to hold for a chain, not just for a pair',
  consequence: 'this is the shape a real "replace my categories" prune has — a group, its subs and their details, all named together — and the two-row case would pass a port that only handled one level',
  parity: 'match',

  // SQLite's own single DELETE answers 1 here (probe-prune-sqlite.mjs
  // s-three-generations-all-named), against the cloud's 3.
  //
  // THIS is the spec that bites, and the two-row one beside it is not. Measured
  // by breaking the port on purpose: with the depth sort removed and the
  // qualifying rows deleted in plain id order, the parent-and-child spec still
  // passes — the child's id happens to sort before the parent's, so id order IS
  // deepest-first for that pair, by luck. Three generations answered 2 instead
  // of 3 and failed loudly. A family that only tested the pair would have been
  // asserting an accident.
  setup: setups(prunablePair, prunableChild, prunableGrandchild),
  command: {
    verb: 'delete_unused_categories',
    payload: { ids: [PRUNABLE, PRUNABLE_CHILD, PRUNABLE_GRANDCHILD], user_id: null },
  },
  expect: { outcome: 'ok' },
  result: { deleted: 3 },
  state: [
    categoryPresent(PRUNABLE, 'GONE'),
    categoryPresent(PRUNABLE_GRANDCHILD, 'GONE'),
    rowCount('categories_left', 'categories', '6'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
