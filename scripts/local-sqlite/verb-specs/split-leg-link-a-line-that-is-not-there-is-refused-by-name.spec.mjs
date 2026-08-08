import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, MATCHING, splitWithAnUnlinkedLeg, matchingRow,
  setups, balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  transferShape, auditRowsInTotal } from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'pairing a split line that does not exist refuses and writes nothing',
  design: 'link_split_line_transfer 20260806094058:530-535',
  consequence: 'a transaction is typed as a transfer and pointed at a line that is not there',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, matchingRow),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: '50000000-0000-0000-0000-0000000000ff', transaction_id: MATCHING, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'split_line_not_found' },

  state: [
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:-:- | 1:-10.00:Weekly shop:-:-:-'),
    transferShape(MATCHING, 'income:-:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
