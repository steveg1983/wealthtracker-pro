import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// The FIRST statement of the RPC body, before the lock and before any read —
// which is why it beats `transaction_not_found`. MEASURED (probe-transfers3.sh,
// `rct-distinct-beats-missing`): passing the same MISSING id twice says "three
// distinct rows", not "not found".
//
// The check is not pedantry. If the stranded row and the partner were the same
// row, the repair would file it as an adjustment and then link it as a transfer,
// in that order, and the row would end up a transfer filed under Account
// Adjustment — a state no other path can produce and none can explain.
export default {
  invariant: 'T-14',
  title: 'the stranded row, its other side and the displaced row must be three different rows',
  design: 'repair_claimed_transfer 20260805145035:283-288',
  consequence: 'one row is written twice by three steps that assume it is three rows, and lands in a state no other path can produce',
  parity: 'match',

  setup: claimedTransfer,
  command: { verb: 'repair_claimed_transfer', payload: repairPayload({ counterpart_id: STRANDED }) },
  expect: { outcome: 'refused', error: 'repair_needs_three_distinct_rows' },

  state: [
    transferShape(STRANDED, 'expense:-:-:-:-'),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
