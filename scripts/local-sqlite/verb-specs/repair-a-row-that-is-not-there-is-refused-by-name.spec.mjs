import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// One of three `transaction_not_found` sites, all with the same code and three
// different HINTs — the hint is the only thing telling a user WHICH of the three
// rows went. The state assertions are the point: a repair that had already
// broken the wrong pairing before discovering the third row was missing would
// leave the ledger in a state no single write intended, which is the saga this
// RPC replaced.
export default {
  invariant: 'X-6',
  title: 'a repair naming a row that no longer exists refuses and writes nothing',
  design: 'repair_claimed_transfer 20260805145035:312-317',
  consequence: 'the three-step repair half-completes and the compensation that was supposed to undo it is itself a thing that can fail',
  parity: 'match',

  setup: claimedTransfer,
  command: {
    verb: 'repair_claimed_transfer',
    payload: repairPayload({ partner_id: '70000000-0000-0000-0000-0000000000ff' }),
  },
  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    transferShape(STRANDED, 'expense:-:-:-:-'),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferShape(COUNTERPART, `transfer:-:0001:${PARTNER.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
