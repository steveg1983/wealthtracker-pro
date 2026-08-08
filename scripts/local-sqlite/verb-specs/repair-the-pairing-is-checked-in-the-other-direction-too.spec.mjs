import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// The SECOND half of T-15, and it needs its own spec because a check written one
// way round passes half the time — and the half it passes is a real half of the
// data.
//
// Its sibling spec breaks `counterpart -> partner`. This one breaks
// `partner -> counterpart`: the counterpart still points at the partner, but the
// partner has been unlinked by something else since the list was built. A repair
// that only asked the first question would say "yes, still linked" and then
// break a pairing that is already half undone — turning one one-sided link into
// two.
//
// `IS DISTINCT FROM` in both directions is what makes it symmetric, and both
// directions are also proven from the Rust side in
// `tests/transfer_family.rs::a_repair_refuses_a_pair_that_is_no_longer_mutual_in_either_direction`.
export default {
  invariant: 'T-7',
  title: 'a pair whose OTHER side has been unlinked since is refused too',
  design: 'repair_claimed_transfer 20260805145035:327-331 — the second disjunct, which the first does not imply',
  consequence: 'a half-undone pairing is "repaired" into two one-sided links instead of one',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      UPDATE transactions SET linked_transfer_id = NULL WHERE id = '${PARTNER}';`,
    postgres: `${claimedTransfer.postgres}
      UPDATE public.transactions SET linked_transfer_id = NULL WHERE id = '${PARTNER}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'transfer_pair_not_linked' },

  state: [
    transferShape(STRANDED, 'expense:-:-:-:-'),
    transferShape(PARTNER, 'transfer:-:0002:-:-'),
    transferShape(COUNTERPART, `transfer:-:0001:${PARTNER.slice(-4)}:-`),
    transferLinksAreMutual('BROKEN'),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
