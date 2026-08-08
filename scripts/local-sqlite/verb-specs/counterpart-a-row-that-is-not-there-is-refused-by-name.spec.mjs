import { USER, EVERYDAY, RAINY_DAY, RAINY_DAY as TARGET,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsInTotal } from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'minting a counterpart for a row that does not exist refuses and mints nothing',
  design: 'create_transfer_counterpart 20260721090000:34-39',
  consequence: 'a row is invented in an account with nothing on the other side, and that account\'s balance moves for money that does not exist',
  parity: 'match',

  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: '70000000-0000-0000-0000-0000000000ff', target_account_id: TARGET, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    rowsInAccount(RAINY_DAY, '0'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
