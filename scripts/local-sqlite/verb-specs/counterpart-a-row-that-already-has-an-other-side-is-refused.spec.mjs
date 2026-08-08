import { USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, OTHER_LEG, THIS_LEG, transferPair, thirdAccount,
  setups, balanceOf, balanceIdentityHolds, rowsInAccount, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// T-3, and the reason it matters more here than anywhere else: this verb MINTS.
// Without the check, one row would acquire a second other side, its original
// counterpart would be left pointing at a row that now points elsewhere, and the
// third account's balance would move for money that never left the first two.
export default {
  invariant: 'T-3',
  title: 'a row that is already half a transfer does not get a second other side',
  design: 'create_transfer_counterpart 20260721090000:48-50',
  consequence: 'one movement of money is minted twice and a third account\'s balance moves for it',
  parity: 'match',

  setup: setups(transferPair, thirdAccount),
  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: OTHER_LEG, target_account_id: HOLIDAY_FUND, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'transaction is already part of a linked transfer' },

  state: [
    transferShape(OTHER_LEG, `transfer:-:0002:${THIS_LEG.slice(-4)}:-`),
    transferLinksAreMutual(),
    rowsInAccount(HOLIDAY_FUND, '0'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(HOLIDAY_FUND, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    auditRowsInTotal('0'),
  ],
};
