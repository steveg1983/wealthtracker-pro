import {
  CORNER_SHOP, EVERYDAY, PRUNABLE, filedUnderTheSource, prunablePair, setups,
  balanceIdentityHolds, categoryPresent, filedAs,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a category a transaction still names is left alone',
  design: "20260713100000:336-339. The whole reason the RPC exists: the client plans from a snapshot that can be stale, and transactions.category is TEXT with no foreign key, so deleting a referenced category orphans that transaction's categorisation permanently",
  consequence: 'a row filed under a category that no longer exists shows blank in the register and counts under nothing in every report, and nothing in the product can tell the user what it used to be',
  parity: 'match',

  setup: setups(prunablePair, filedUnderTheSource),
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [
    categoryPresent(PRUNABLE, 'HERE'),
    filedAs(CORNER_SHOP, 'Food shopping/Food shopping'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
