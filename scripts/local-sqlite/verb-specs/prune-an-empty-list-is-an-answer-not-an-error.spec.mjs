import { EVERYDAY, prunablePair, balanceIdentityHolds, rowCount } from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'nothing named, nothing deleted, nothing wrong',
  design: '`id = ANY(\'{}\')` matches nothing and the function returns 0. MEASURED that a NULL array behaves identically (probe-prune1.sh p-null-array), which is why the local command takes an Option and treats absent, null and empty as one request',
  consequence: 'the client already guards this (planningService.ts:506 returns 0 for an empty list) — and a verb whose behaviour depends on a caller remembering to guard it is a verb with a bug waiting for a second caller',
  parity: 'match',

  setup: prunablePair,
  command: { verb: 'delete_unused_categories', payload: { ids: [], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [rowCount('categories_left', 'categories', '7'), balanceIdentityHolds(EVERYDAY)],
};
