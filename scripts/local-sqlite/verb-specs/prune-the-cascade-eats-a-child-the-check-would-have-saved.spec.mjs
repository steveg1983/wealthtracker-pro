import {
  CORNER_SHOP, EVERYDAY, PRUNABLE, PRUNABLE_CHILD, prunableChild, prunablePair, setups,
  balanceIdentityHolds, categoryPresent, filedAs,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'the measured hole: a REFERENCED child dies with the parent that was named beside it',
  design: 'the interaction of 20260713100000:336-339 (a referenced row is skipped) with :353-358 (a child IN the batch does not keep its parent alive) and `categories.parent_id ON DELETE CASCADE`',
  consequence: '20260708160000\'s header promises that "a stale client can never destroy referenced data". It is FALSE in this shape, on BOTH engines: the child\'s own check skips it, the parent\'s check passes because the child is in the batch, and the cascade takes it anyway — leaving the transaction filed under an id nothing answers to',
  parity: 'match',

  // MEASURED on both engines (probe-prune1.sh p-cascade-eats-a-referenced-child,
  // probe-prune-sqlite3.mjs c-cascade-eats-a-referenced-child) and reproduced
  // rather than fixed, for the reason merge_categories gives about what it
  // leaves behind: a port that tidied this would refuse a prune the cloud
  // performs. What the local edition does instead is REPORT it —
  // integrity-r3-a-transaction-filed-under-a-category-nothing-answers-to plants
  // exactly this wreckage and reads it back.
  //
  // Note the count: ONE, not two. The child was removed by the cascade rather
  // than by the statement, and neither engine counts it.
  setup: {
    sqlite: `${setups(prunablePair, prunableChild).sqlite}
      UPDATE transactions SET category = '${PRUNABLE_CHILD}' WHERE id = '${CORNER_SHOP}';`,
    postgres: `${setups(prunablePair, prunableChild).postgres}
      UPDATE public.transactions SET category = '${PRUNABLE_CHILD}' WHERE id = '${CORNER_SHOP}';`,
  },
  command: {
    verb: 'delete_unused_categories',
    payload: { ids: [PRUNABLE, PRUNABLE_CHILD], user_id: null },
  },
  expect: { outcome: 'ok' },
  result: { deleted: 1 },
  state: [
    categoryPresent(PRUNABLE, 'GONE'),
    categoryPresent(PRUNABLE_CHILD, 'GONE'),
    filedAs(CORNER_SHOP, `${PRUNABLE_CHILD}/NULL`),
    balanceIdentityHolds(EVERYDAY),
  ],
};
