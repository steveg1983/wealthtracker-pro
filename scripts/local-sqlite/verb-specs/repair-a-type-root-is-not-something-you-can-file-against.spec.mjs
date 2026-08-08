import { EVERYDAY, RAINY_DAY, OUTGOINGS, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// The `level <> 'type'` condition on its own. A type root is the top of the
// tree — "Outgoings" — and nothing is filed against one; a client that resolved
// "Account Adjustment" by walking up to the nearest ancestor would send exactly
// this. The message is the same as for an id nobody has, deliberately: the
// caller's remedy is identical either way.
export default {
  invariant: 'C-2',
  title: 'a bare type root cannot be the adjustment category',
  design: 'repair_claimed_transfer 20260805145035:390 — AND c.level <> \'type\'',
  consequence: 'the displaced row is filed against a tree root, where no report expects to find a transaction',
  parity: 'match',

  setup: claimedTransfer,
  command: { verb: 'repair_claimed_transfer', payload: repairPayload({ adjustment_category_id: OUTGOINGS }) },
  expect: { outcome: 'refused', error: 'unknown or transfer category' },

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
