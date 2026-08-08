import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// T-15, and the ONLY place in the entire schema where mutual linkage (T-7) is
// tested at all — DESIGN.md §1.3: *"Enforced nowhere as a constraint. Only
// repair_claimed_transfer even checks it."*
//
// It is checked BOTH ways round, and this spec breaks the direction a one-sided
// check would miss: the partner still points at the counterpart, but the
// counterpart has been re-pointed elsewhere. A check that only asked
// "does the partner point at the counterpart?" would say yes and break a pairing
// that some other device had already re-arranged.
//
// MEASURED that this beats every structural refusal below it
// (probe-transfers3.sh, `rct-linkage-beats-split`): a stale tab is told its
// picture is stale before it is told anything about splits or archives.
export default {
  invariant: 'T-15',
  title: 'a pair that has been re-arranged since the list was built is refused, checked both ways round',
  design: 'repair_claimed_transfer 20260805145035:327-331 — IS DISTINCT FROM, in both directions',
  consequence: 'a stale browser tab unlinks a pair another device has already fixed, and the fix is undone by a click on a stale screen',
  parity: 'match',

  setup: {
    sqlite: `${claimedTransfer.sqlite}
      UPDATE transactions SET linked_transfer_id = NULL WHERE id = '${COUNTERPART}';`,
    postgres: `${claimedTransfer.postgres}
      UPDATE public.transactions SET linked_transfer_id = NULL WHERE id = '${COUNTERPART}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'transfer_pair_not_linked' },

  state: [
    transferShape(STRANDED, 'expense:-:-:-:-'),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferShape(COUNTERPART, 'transfer:-:0001:-:-'),
    // The fixture is deliberately left one-sided by the setup, so this asserts
    // the verb did not make it any worse.
    transferLinksAreMutual('BROKEN'),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
