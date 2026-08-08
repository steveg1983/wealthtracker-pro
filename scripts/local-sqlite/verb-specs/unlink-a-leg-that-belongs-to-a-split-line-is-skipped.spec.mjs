import { USER, EVERYDAY, RAINY_DAY, LEG_COUNTERPART, LEG_LINE, splitWithTransferLeg,
  balanceOf, balanceIdentityHolds, transferShape, splitLineState, legPairsAreMutual,
  splitSumHolds, auditRowsInTotal } from './_shared.mjs';

// T-12, and the reason it is a rule rather than an oversight (`:87-90`): a row
// whose link lives on a split LINE is skipped, never unlinked here, because
// *"that structure is unpicked by editing the split, and clearing only the
// transaction side would leave the split line pointing at a row that no longer
// points back."*
//
// The row named here is a split leg's counterpart: it carries
// `linked_transfer_split_id`, and that column — not the type, not the amount —
// is what makes the cursor pass it by. Nothing is written, nothing is audited,
// and the count is zero, which the client reads as "there was nothing here to
// unlink" rather than as an error.
export default {
  invariant: 'T-12',
  title: 'a row whose link lives on a split line is skipped, not unlinked',
  design: 'clear_transfer_links 20260805145035:136 — AND linked_transfer_split_id IS NULL',
  consequence: 'the split line is left pointing at a row that no longer points back, and the split becomes uneditable by the very rule that protects it',
  parity: 'match',

  setup: splitWithTransferLeg,
  command: { verb: 'clear_transfer_links', payload: { ids: [LEG_COUNTERPART], user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: LEG_COUNTERPART, type: 'transfer' },

  state: [
    // Still linked to its line, and the line still linked to it.
    splitLineState(LEG_LINE, 'linked'),
    legPairsAreMutual(),
    splitSumHolds('70000000-0000-0000-0000-000000000001'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
