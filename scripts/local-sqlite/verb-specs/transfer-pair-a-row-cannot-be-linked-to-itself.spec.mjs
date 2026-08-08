import { USER, EVERYDAY, RAINY_DAY, PAIR_OUT, pairableRows,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// The FIRST statement of the RPC body, before the lock and before either row is
// read — which is why this fires even for an id that does not exist. MEASURED
// (probe-transfers.sh, `ltp-self-beats-notfound`): linking a missing id to
// itself says "cannot be linked to itself", not "transaction_not_found". A port
// that read both rows first and compared afterwards would produce the other
// sentence and nobody would notice until a user saw it.
export default {
  invariant: 'T-2',
  title: 'a transaction cannot be linked to itself',
  design: 'link_transfer_pair 20260716100000:80-82 — the self-check precedes the lock and both reads',
  consequence: 'a row points at itself: one movement of money counted as two, in one account, with no other side to reconcile against',
  parity: 'match',

  setup: pairableRows,
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_OUT, user_id: USER } },
  expect: { outcome: 'refused', error: 'a transaction cannot be linked to itself' },

  state: [
    transferShape(PAIR_OUT, 'expense:Weekly shop:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
