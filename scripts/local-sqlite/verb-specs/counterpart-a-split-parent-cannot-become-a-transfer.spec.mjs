import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, splitWithAnUnlinkedLeg,
  balanceOf, balanceIdentityHolds, rowsInAccount, splitSumHolds, splitLines,
  auditRowsInTotal } from './_shared.mjs';

// T-5, on the verb that would otherwise MINT the contradiction rather than
// merely record it: a split parent whose amount is the sum of its lines, given a
// second authority for that same number in another account.
export default {
  invariant: 'T-5',
  title: 'a split parent cannot have a counterpart minted for it',
  design: 'create_transfer_counterpart 20260721090000:44-47',
  consequence: 'a row\'s amount is claimed by both its split lines and a row in another account, and the two can disagree',
  parity: 'match',

  setup: splitWithAnUnlinkedLeg,
  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: CORNER_SHOP, target_account_id: RAINY_DAY, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'a split transaction cannot become a transfer' },

  state: [
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:-:- | 1:-10.00:Weekly shop:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    rowsInAccount(RAINY_DAY, '0'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
