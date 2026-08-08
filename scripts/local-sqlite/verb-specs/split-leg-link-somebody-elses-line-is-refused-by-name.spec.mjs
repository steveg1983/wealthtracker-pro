import { STRANGER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_LINE, MATCHING,
  splitWithAnUnlinkedLeg, matchingRow, secondUser, setups,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// X-6, and note WHICH user_id the gate uses: `transaction_splits.user_id`, the
// line's own column, not its parent's. The two are copied from each other by
// every writer and can differ in restored data, and the RPC's WHERE clause names
// the line's — so this port does too.
export default {
  invariant: 'X-6',
  title: 'pairing a split line as a user who does not own it is refused by name',
  design: 'link_split_line_transfer 20260806094058:530-535 — WHERE id = p_split_id AND user_id = p_user_id, on the LINE',
  consequence: 'one login can make another login\'s split line half of a transfer',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, matchingRow, secondUser),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: MATCHING, user_id: STRANGER },
  },
  expect: { outcome: 'refused', error: 'split_line_not_found' },

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
