import {
  EVERYDAY, PRUNABLE, PRUNABLE_CHILD, prunableChild, prunablePair, setups,
  balanceIdentityHolds, categoryPresent,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a parent with a child the caller did not name is left where it is',
  design: '20260713100000:353-358 — "a child that is NOT part of this batch keeps its parent alive", which blocks the parent_id CASCADE from killing rows the client never saw',
  consequence: 'without it, one id in a stale plan takes an entire unseen subtree with it, and the user is left wondering where half their categories went',
  parity: 'match',

  setup: setups(prunablePair, prunableChild),
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [
    categoryPresent(PRUNABLE, 'HERE'),
    categoryPresent(PRUNABLE_CHILD, 'HERE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
