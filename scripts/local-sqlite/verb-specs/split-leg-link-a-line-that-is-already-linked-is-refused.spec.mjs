import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_LINE, MATCHING,
  splitWithTransferLeg, matchingRow, setups,
  balanceOf, balanceIdentityHolds, splitLineState, splitSumHolds, legPairsAreMutual,
  transferShape, auditRowsInTotal } from './_shared.mjs';

// S-9/T-11. A line that is already one half of a transfer has a counterpart
// pointing back at it; re-pointing it would strand that counterpart. This is
// also the refusal that makes the `leg` guard unnecessary in this verb: the only
// line it ever UPDATEs is one whose `linked_transfer_id` is NULL, which is
// exactly the case `trg_protect_linked_leg`'s WHEN clause excludes.
export default {
  invariant: 'S-9',
  title: 'a split line that is already half a transfer cannot be paired again',
  design: 'link_split_line_transfer 20260806094058:558-561',
  consequence: 'the line acquires a second other side and its original counterpart is stranded pointing at a line that has moved on',
  parity: 'match',

  setup: setups(splitWithTransferLeg, matchingRow),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: MATCHING, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'split_line_already_linked' },

  state: [
    splitLineState(LEG_LINE, 'linked'),
    transferShape(MATCHING, 'income:-:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
