import { EVERYDAY, PRUNABLE, prunablePair, balanceIdentityHolds, categoryPresent } from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a repeated id is one deletion, not two',
  design: '`id = ANY(p_ids)` matches each row once however many times its id appears in the array. The local port builds the same set through the shared distinct_ids',
  consequence: 'the count is a promise about rows, not about the caller\'s list. A planner that emits a category twice — a detail reached through two groups, say — must not make the summary claim two deletions',
  parity: 'match',

  setup: prunablePair,
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE, PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 1 },
  state: [categoryPresent(PRUNABLE, 'GONE'), balanceIdentityHolds(EVERYDAY)],
};
