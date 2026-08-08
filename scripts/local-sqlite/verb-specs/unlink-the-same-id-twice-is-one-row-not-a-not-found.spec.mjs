import { USER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG, transferPair,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditRowsInTotal } from './_shared.mjs';

// The DISTINCT in `count(DISTINCT x)` is doing real work, and it is the kind of
// detail a port drops. `[X, X]` names one row twice: two ids, one matching row.
// A check written as `count(*) <> count(*)` — the obvious spelling — would refuse
// a perfectly good call.
//
// MEASURED (probe-transfers3.sh, `ctl-duplicate-ids`): the cloud accepts it and
// returns 1. One audit row, which is the same number.
export default {
  invariant: 'T-12',
  title: 'naming the same row twice unlinks it once, and is not a not-found',
  design: 'clear_transfer_links 20260805145035:120 — count(DISTINCT x), not count(*)',
  consequence: 'a client that de-duplicates badly gets an exception instead of an unlink',
  parity: 'match',

  setup: transferPair,
  command: { verb: 'clear_transfer_links', payload: { ids: [OTHER_LEG, OTHER_LEG], user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: OTHER_LEG, linked_transfer_id: null },

  state: [
    transferShape(OTHER_LEG, 'transfer:-:0002:-:-'),
    transferShape(THIS_LEG, `transfer:-:0001:${OTHER_LEG.slice(-4)}:-`),
    linkedRows('1'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    // One real change, so exactly one audit row — the returned count and this
    // number are the same number by construction.
    auditRowsInTotal('1'),
    transferLinksAreMutual('BROKEN'),
  ],
};
