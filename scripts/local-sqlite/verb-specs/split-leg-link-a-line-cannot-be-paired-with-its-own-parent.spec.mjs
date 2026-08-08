import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_LINE, splitWithAnUnlinkedLeg, matchingRow,
  setups, balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// The self-link check, and MEASURED to beat `split_line_already_linked`
// (probe-transfers4.sh, `lsl-self-beats-line-linked`) — a linked line aimed at
// its own parent is told about the self-link.
//
// What it prevents is worth stating: the parent would become type `transfer`
// while remaining `is_split = 1`, which the local file forbids outright
// (`transactions_transfer_not_split`) and the cloud does not — so without this
// check the two engines would disagree about a payload a confused client could
// really send.
export default {
  invariant: 'T-5',
  title: 'a split line cannot be paired with the split it belongs to',
  design: 'link_split_line_transfer 20260806094058:555-557',
  consequence: 'the split parent becomes its own transfer counterpart: a row that is both a split and a transfer, which one engine refuses and the other stores',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, matchingRow),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: CORNER_SHOP, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'a transaction cannot be linked to itself' },

  state: [
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:-:- | 1:-10.00:Weekly shop:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
