import { EVERYDAY, OUTGOINGS, prunablePair, balanceIdentityHolds, categoryPresent } from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a top-level heading is left where it is, and the call still succeeds',
  design: "20260713100000:334, `c.level <> 'type'`. Every protection in this function is a WHERE clause; there is no RAISE in it at all",
  consequence: 'a stale client plans a prune from a snapshot taken minutes ago. Refusing the batch because one id in it turned out to be a heading would lose the other two hundred deletions the user asked for and leave them to do it by hand',
  parity: 'match',

  setup: prunablePair,
  command: { verb: 'delete_unused_categories', payload: { ids: [OUTGOINGS], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [categoryPresent(OUTGOINGS, 'HERE'), balanceIdentityHolds(EVERYDAY)],
};
