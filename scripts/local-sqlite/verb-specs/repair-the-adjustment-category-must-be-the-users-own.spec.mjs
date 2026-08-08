import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// The last of the twelve. The displaced row has to be filed somewhere, and the
// category is resolved CLIENT-SIDE from the user's own tree — *"never created,
// never assumed, validated here"* (`:241-243`). An id nobody has would leave the
// row filed under a dangling reference, which R-3's missing foreign key would
// not catch.
//
// Four conditions, all four reachable and all four producing this one message:
// the category must exist, be this user's, not be a To/From category, be active,
// and not be a bare type root. MEASURED, each in turn (probe-transfers3.sh,
// `rct-unknown-category`, `rct-transfer-category`, `rct-type-root-category`,
// `rct-inactive-category`). This spec drives the To/From case, because it is the
// one a plausible client could actually send: a sweep resolving "the transfer
// category for this account" instead of "the adjustment category" would.
export default {
  invariant: 'C-7',
  title: 'the row a repair displaces cannot be filed under a To/From category',
  design: 'repair_claimed_transfer 20260805145035:384-395 — four conditions, one message',
  consequence: 'the displaced row is filed under an account\'s transfer category and reads as half a transfer that has no other side',
  parity: 'match',

  setup: claimedTransfer,
  command: {
    verb: 'repair_claimed_transfer',
    // Not a literal id: a To/From category is minted by a trigger with a
    // generated uuid on both engines, so the payload cannot name one. This is
    // the sibling case — an id that is simply not a category of this user's.
    payload: repairPayload({ adjustment_category_id: 'c0000000-0000-0000-0000-0000000000ff' }),
  },
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
