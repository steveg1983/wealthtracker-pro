import {
  EVERYDAY, PRUNABLE, prunablePair,
  auditRowsInTotal, balanceIdentityHolds, categoryPresent, rowCount,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'an ordinary leaf nothing refers to is removed, and counted',
  design: '20260713100000:320-363, the live definition. Recreated from 20260708160000 with one addition, the transaction_splits guard',
  consequence: 'this is the "make my categories BE the Money set" import. If the prune does not work the user is left with two category trees merged into one list and no way to tell which half is theirs',
  parity: 'match',

  setup: prunablePair,
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 1 },
  state: [
    categoryPresent(PRUNABLE, 'GONE'),
    rowCount('categories_left', 'categories', '6'),
    // It audits NOTHING, on both engines. MEASURED (probe-prune1.sh
    // p-plain-unused): the cloud writes no audit row here, and the port's module
    // documentation carries the argument for why the local edition does not
    // "fix" that.
    auditRowsInTotal('0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
